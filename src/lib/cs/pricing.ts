/**
 * Deterministic pricing engine for the CS booking flow.
 *
 * The LLM is good at understanding free text but unreliable at arithmetic and at
 * judging which dates are weekdays vs weekends/holidays. So we let the LLM only
 * EXTRACT structured parameters (dates, room, guest counts) and do every number
 * here, in code. The result is an itemised, authoritative quote the AI must quote
 * verbatim.
 */

export interface PricingSegment {
  label: string
  key: string
  weekdayPrice: number
  weekendPrice: number
}

export interface PricingRoom {
  name: string
  capacity: number
  baseCapacity?: number
  weekdayPrice: number
  weekendPrice: number
  holidayPrice?: number
  extraPersonFee?: number
  extraBedNote?: string
  description?: string
}

export interface PricingConfig {
  productType: 'tour' | 'accommodation' | 'custom'
  triggerKeywords: string[]
  currency?: string
  schedules?: Array<{ id: string; name: string }>
  segments?: PricingSegment[]
  packages?: Array<{ name: string; price: number; description?: string }>
  groupDiscounts?: Array<{ minPeople: number; discountPercent: number; note?: string }>
  rooms?: PricingRoom[]
  cancellationPolicy?: string
  notes?: string[]
  customContent?: string
}

export interface QuoteLine {
  label: string
  amount: number
}

export interface QuoteResult {
  lines: QuoteLine[]
  total: number
  currency: string
  warnings: string[]
}

/** Day classification for a single night/day. */
export type DayKind = 'weekday' | 'weekend' | 'holiday'

/**
 * Classify a date as weekday / weekend / holiday.
 * Business rule (from the pricing config UI): 平日 = Mon–Thu, 假日 = Fri–Sun.
 * Dates present in `holidays` (YYYY-MM-DD) are treated as holiday (連續假期).
 */
export function classifyDay(isoDate: string, holidays: Set<string> = new Set()): DayKind {
  if (holidays.has(isoDate)) return 'holiday'
  const d = new Date(`${isoDate}T00:00:00`)
  const dow = d.getUTCDay() // 0=Sun … 6=Sat
  // Fri(5), Sat(6), Sun(0) → weekend; Mon–Thu → weekday
  return dow === 0 || dow === 5 || dow === 6 ? 'weekend' : 'weekday'
}

/** Enumerate the nights of a stay as ISO dates (check-in inclusive, check-out exclusive). */
export function enumerateNights(checkIn: string, checkOut: string): string[] {
  const start = new Date(`${checkIn}T00:00:00Z`)
  const end = new Date(`${checkOut}T00:00:00Z`)
  const nights: string[] = []
  if (isNaN(start.getTime()) || isNaN(end.getTime()) || end <= start) return nights
  for (let t = start.getTime(); t < end.getTime(); t += 86400000) {
    nights.push(new Date(t).toISOString().slice(0, 10))
  }
  return nights
}

function roundMoney(n: number): number {
  return Math.round(n * 100) / 100
}

export interface AccommodationParams {
  roomName: string
  checkIn: string   // YYYY-MM-DD
  checkOut: string  // YYYY-MM-DD
  guests: number
  holidays?: string[]
}

/** Compute an accommodation total night-by-night using the matched room's rates. */
export function computeAccommodation(config: PricingConfig, params: AccommodationParams): QuoteResult | null {
  const currency = config.currency ?? 'TWD'
  const warnings: string[] = []
  const rooms = config.rooms ?? []
  if (!rooms.length) return null

  // Match the room by name (case/space-insensitive, allow partial contains both ways)
  const norm = (s: string) => s.toLowerCase().replace(/\s+/g, '')
  const target = norm(params.roomName)
  const room = rooms.find(r => norm(r.name) === target)
    ?? rooms.find(r => target && (norm(r.name).includes(target) || target.includes(norm(r.name))))
  if (!room) return null

  const nights = enumerateNights(params.checkIn, params.checkOut)
  if (!nights.length) return null
  const holidaySet = new Set(params.holidays ?? [])

  const lines: QuoteLine[] = []
  let total = 0
  const counts: Record<DayKind, number> = { weekday: 0, weekend: 0, holiday: 0 }
  for (const date of nights) {
    const kind = classifyDay(date, holidaySet)
    let rate: number
    if (kind === 'holiday') rate = room.holidayPrice ?? room.weekendPrice
    else if (kind === 'weekend') rate = room.weekendPrice
    else rate = room.weekdayPrice
    counts[kind]++
    total += rate
  }

  const label = (k: DayKind) => (k === 'weekday' ? '平日' : k === 'weekend' ? '假日' : '連續假期')
  for (const k of ['weekday', 'weekend', 'holiday'] as DayKind[]) {
    if (counts[k] > 0) {
      const rate = k === 'holiday' ? (room.holidayPrice ?? room.weekendPrice) : k === 'weekend' ? room.weekendPrice : room.weekdayPrice
      lines.push({ label: `${room.name} ${label(k)} $${rate.toLocaleString()} × ${counts[k]} 晚`, amount: rate * counts[k] })
    }
  }

  // Extra-person fee: Base occupancy is 2 (雙人房基準).
  // Room capacity is the maximum allowed guests (最多容納人數上限).
  const baseGuests = room.baseCapacity ?? 2
  if (params.guests > room.capacity) {
    warnings.push(`入住人數 ${params.guests} 超過 ${room.name} 上限 ${room.capacity} 人，該房型最多僅能容納 ${room.capacity} 人。`)
  } else if (params.guests > baseGuests) {
    const extra = params.guests - baseGuests
    if (room.extraPersonFee && room.extraPersonFee > 0) {
      const amount = room.extraPersonFee * extra * nights.length
      lines.push({ label: `加人費 $${room.extraPersonFee.toLocaleString()} × ${extra} 人 × ${nights.length} 晚`, amount })
      total += amount
    } else {
      warnings.push(`入住人數 ${params.guests} 人超過雙人基準（2人），請依加人收費規則計費。`)
    }
  }

  return { lines, total: roundMoney(total), currency, warnings }
}

export interface TourParams {
  date?: string // YYYY-MM-DD (to decide weekday/weekend)
  isWeekend?: boolean // explicit override if no date
  items: Array<{ key?: string; label?: string; qty: number }>
  packages?: Array<{ name: string; qty: number }>
  holidays?: string[]
}

/** Compute a tour total from per-segment ticket counts, then apply group discount. */
export function computeTour(config: PricingConfig, params: TourParams): QuoteResult | null {
  const currency = config.currency ?? 'TWD'
  const warnings: string[] = []
  const segments = config.segments ?? []
  const lines: QuoteLine[] = []
  let total = 0
  let totalPeople = 0

  const weekend = params.date
    ? classifyDay(params.date, new Set(params.holidays ?? [])) !== 'weekday'
    : !!params.isWeekend

  for (const item of params.items ?? []) {
    if (item.qty <= 0) continue
    const seg = segments.find(s =>
      (item.key && s.key === item.key) ||
      (item.label && (s.label === item.label || s.label.includes(item.label) || item.label.includes(s.label)))
    )
    if (!seg) {
      warnings.push(`找不到票種「${item.label ?? item.key ?? ''}」，請人工確認。`)
      continue
    }
    const price = weekend ? seg.weekendPrice : seg.weekdayPrice
    lines.push({ label: `${seg.label}（${weekend ? '假日' : '平日'}）$${price.toLocaleString()} × ${item.qty}`, amount: price * item.qty })
    total += price * item.qty
    totalPeople += item.qty
  }

  for (const pk of params.packages ?? []) {
    if (pk.qty <= 0) continue
    const def = (config.packages ?? []).find(p => p.name === pk.name || p.name.includes(pk.name) || pk.name.includes(p.name))
    if (!def) { warnings.push(`找不到套餐「${pk.name}」，請人工確認。`); continue }
    lines.push({ label: `${def.name} $${def.price.toLocaleString()} × ${pk.qty}`, amount: def.price * pk.qty })
    total += def.price * pk.qty
    totalPeople += pk.qty
  }

  if (!lines.length) return null

  // Group discount: pick the best (highest minPeople met)
  const discounts = (config.groupDiscounts ?? []).filter(g => totalPeople >= g.minPeople).sort((a, b) => b.minPeople - a.minPeople)
  if (discounts.length) {
    const g = discounts[0]
    const discountAmount = roundMoney(total * (g.discountPercent / 100))
    if (discountAmount > 0) {
      lines.push({ label: `團體優惠（${totalPeople} 人，折 ${g.discountPercent}%）`, amount: -discountAmount })
      total -= discountAmount
    }
  }

  return { lines, total: roundMoney(total), currency, warnings }
}

// Replace digit*digit (multiplication used in bed sizes) with × to avoid Markdown misparse
const sanitizeDim = (s: string) => s.replace(/(\d)\*(\d)/g, '$1×$2')

/**
 * Render a PricingConfig as free-form text for the AI prompt (used when the
 * deterministic quote engine above can't compute an exact number — e.g. no
 * matching room/date yet — so the AI still has the raw rate table to work from).
 * Shared by cs-chat (test sandbox) and cs-webhook (live channels) so business
 * owners testing in the CS workspace see the same pricing prompt real customers get.
 */
export function formatPricingForAI(name: string, cfg: PricingConfig): string {
  const cur = cfg.currency ?? 'TWD'
  const lines: string[] = [
    `【定價計算機：${name}】`,
    `以下為精確定價資料，計算時請逐步列式、每個數字必須照表使用，禁止估算。`,
    `報價格式規定：直接輸出各晚最終金額（假日/週末價已含加價，直接查表取值）；禁止在回覆中顯示任何加價乘數（× 1.15、× 1.2 等）；若有折扣優惠才可在總價後標注（例：享9.5折）。`,
  ]

  if (cfg.productType === 'tour') {
    if (cfg.schedules?.length) {
      lines.push('\n可選班次：')
      cfg.schedules.forEach(s => lines.push(`  ${s.name}`))
    }
    if (cfg.segments?.length) {
      lines.push(`\n票價（${cur}）：`)
      lines.push('  ▸ 平日（週一至週四）：')
      cfg.segments.forEach(s => lines.push(`      ${s.label}：$${s.weekdayPrice.toLocaleString()}`))
      lines.push('  ▸ 假日（週五至週日、例假日）：')
      cfg.segments.forEach(s => lines.push(`      ${s.label}：$${s.weekendPrice.toLocaleString()}`))
    }
    if (cfg.packages?.length) {
      lines.push('\n套餐方案：')
      cfg.packages.forEach(p =>
        lines.push(`  • ${p.name}：$${p.price.toLocaleString()}${p.description ? `（${p.description}）` : ''}`)
      )
    }
    if (cfg.groupDiscounts?.length) {
      lines.push('\n團體折扣：')
      cfg.groupDiscounts.forEach(g =>
        lines.push(`  • ${g.minPeople} 人（含）以上：${100 - g.discountPercent}折${g.note ? `（${g.note}）` : ''}`)
      )
    }
  }

  if (cfg.productType === 'accommodation') {
    if (cfg.rooms?.length) {
      lines.push(`\n房型與定價（${cur}）：`)
      lines.push(`⚠️ 【核心入住與定價規則】`)
      lines.push(`   1. 基準定價：所有房型的平日價、假日價、連假價均為【雙人入住價格】（基準人數：2 人）。`)
      lines.push(`   2. 最多容納人數與加床限制：`)
      lines.push(`      - 最多 2 人房型：不可加人、不可加床，最多僅能入住 2 人。若客人超過 2 人請明確告知該房型無法加床或無法容納。`)
      lines.push(`      - 最多 3~4 人房型：基準為雙人入住，最多可加人／加床至該房型標示之最多人數。`)
      lines.push(`   3. 加人計價與連續住宿（第二晚）折扣：`)
      lines.push(`      - 若下方「注意事項與備註」中有列出加人詳細計算規則（如連住第1晚/第2晚/第3晚差別收費、大人/小孩/加床/不加床差別收費、連續住宿第二晚優惠等），【必須嚴格優先依據備註中的步驟與詳細規則逐步列式計算】，不得自行簡化！`)
      lines.push(`⚠️ 每個房型定價完全獨立，計算時必須逐房型各自使用下方對應數字，嚴禁合併或混用：`)
      cfg.rooms.forEach(r => {
        const canAdd = (r.capacity ?? 2) > 2
        lines.push(`\n  ▸ 【${r.name}】基準雙人入住，最多容納 ${r.capacity} 人（${canAdd ? `可加人/加床，最多至 ${r.capacity} 人` : '不可加人、不可加床，最多 2 人'}）`)
        if (r.description) lines.push(`      床型：${sanitizeDim(r.description)}`)
        lines.push(`      平日（雙人）：$${r.weekdayPrice.toLocaleString()}`)
        lines.push(`      假日/週末（雙人）：$${r.weekendPrice.toLocaleString()}`)
        if (r.holidayPrice) lines.push(`      連續假期（雙人）：$${r.holidayPrice.toLocaleString()}`)
        if (r.extraPersonFee && r.extraPersonFee > 0) lines.push(`      基礎加人費：$${r.extraPersonFee.toLocaleString()}/人/晚（若下方備註有連住折扣或小孩階梯計費，以備註為準）`)
        if (r.extraBedNote) lines.push(`      加床說明：${sanitizeDim(r.extraBedNote)}`)
      })
    }
  }

  if (cfg.productType === 'custom' && cfg.customContent) {
    lines.push('\n' + cfg.customContent)
  }

  // Fallback: if none of the structured formatters matched, dump raw JSON for AI to interpret
  const hasStructuredOutput = lines.length > 2
  if (!hasStructuredOutput) {
    const displayData = { ...cfg } as Record<string, unknown>
    delete displayData['triggerKeywords']
    delete displayData['productType']
    delete displayData['currency']
    lines.push('\n定價資料（JSON）：')
    lines.push('```json')
    lines.push(JSON.stringify(displayData, null, 2))
    lines.push('```')
    lines.push(`\n貨幣單位：${cur}`)
  }

  if (cfg.cancellationPolicy) {
    lines.push(`\n取消政策：${cfg.cancellationPolicy}`)
  }

  if (cfg.notes?.length) {
    lines.push('\n注意事項：')
    cfg.notes.forEach(n => lines.push(`  • ${n}`))
  }

  return lines.join('\n')
}

/** Keyword-triggered variant: only returns the formatted block when the message matches. */
export function queryJsonPricing(name: string, config: PricingConfig, message: string): string | null {
  const triggered = (config.triggerKeywords ?? []).some(kw =>
    kw.trim() && message.toLowerCase().includes(kw.trim().toLowerCase())
  )
  if (!triggered) return null
  return formatPricingForAI(name, config)
}

/** Render a quote as the authoritative block injected into the system prompt. */
export function formatQuote(result: QuoteResult): string {
  const cur = result.currency
  const body = result.lines
    .map(l => `  ${l.label} = ${l.amount < 0 ? '-' : ''}$${Math.abs(l.amount).toLocaleString()}`)
    .join('\n')
  const warn = result.warnings.length ? `\n注意：\n${result.warnings.map(w => `  ⚠️ ${w}`).join('\n')}` : ''
  return `【系統精算金額（權威，請原文使用此明細與總價，禁止自行加減或重算）】\n${body}\n  ── 總計 = $${result.total.toLocaleString()} ${cur}${warn}`
}
