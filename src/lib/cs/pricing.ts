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

  // Extra-person fee for guests beyond room capacity
  if (params.guests > room.capacity) {
    const extra = params.guests - room.capacity
    if (room.extraPersonFee && room.extraPersonFee > 0) {
      const amount = room.extraPersonFee * extra * nights.length
      lines.push({ label: `加人費 $${room.extraPersonFee.toLocaleString()} × ${extra} 人 × ${nights.length} 晚`, amount })
      total += amount
    } else {
      warnings.push(`入住人數 ${params.guests} 超過 ${room.name} 上限 ${room.capacity} 人，且未設定加人費，請人工確認是否可加床。`)
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

/** Render a quote as the authoritative block injected into the system prompt. */
export function formatQuote(result: QuoteResult): string {
  const cur = result.currency
  const body = result.lines
    .map(l => `  ${l.label} = ${l.amount < 0 ? '-' : ''}$${Math.abs(l.amount).toLocaleString()}`)
    .join('\n')
  const warn = result.warnings.length ? `\n注意：\n${result.warnings.map(w => `  ⚠️ ${w}`).join('\n')}` : ''
  return `【系統精算金額（權威，請原文使用此明細與總價，禁止自行加減或重算）】\n${body}\n  ── 總計 = $${result.total.toLocaleString()} ${cur}${warn}`
}
