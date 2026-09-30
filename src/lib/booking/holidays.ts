// 國定假日行事曆 + 週末／假日定價規則的共用判斷（前後端共用，勿引入 server-only 模組）。
//
// 台灣資料來源：政府資料開放平台「中華民國政府行政機關辦公日曆表」（https://data.gov.tw/dataset/14718，
// CC BY 4.0），使用 ruyut/TaiwanCalendar 整理後的 JSON（修正原始檔編碼/格式問題）。
// 人事行政總處約每年 6 月公布下一年度資料，尚未公布的年份會拿不到資料。

export interface CalendarDay {
  date: string        // YYYY-MM-DD
  isHoliday: boolean  // 放假日（含一般週六日）
  description: string // 節日名稱／補假；一般週末為空字串
}

export const HOLIDAY_COUNTRIES = [
  { code: 'TW', label: '台灣' },
] as const
export type HolidayCountry = typeof HOLIDAY_COUNTRIES[number]['code']

const TW_SOURCES = (year: number) => [
  `https://cdn.jsdelivr.net/gh/ruyut/TaiwanCalendar/data/${year}.json`,
  `https://raw.githubusercontent.com/ruyut/TaiwanCalendar/master/data/${year}.json`,
]

/** 抓取指定國家、年份的辦公日曆。抓不到（尚未公布或來源異常）回傳空陣列。 */
export async function fetchHolidayCalendar(country: string, year: number): Promise<CalendarDay[]> {
  if (country !== 'TW') return []
  for (const url of TW_SOURCES(year)) {
    try {
      const res = await fetch(url, { next: { revalidate: 86400 } } as RequestInit)
      if (!res.ok) continue
      const raw = await res.json() as { date: string; isHoliday: boolean; description?: string }[]
      if (!Array.isArray(raw)) continue
      return raw
        .filter(d => /^\d{8}$/.test(d.date))
        .map(d => ({
          date: `${d.date.slice(0, 4)}-${d.date.slice(4, 6)}-${d.date.slice(6, 8)}`,
          isHoliday: !!d.isHoliday,
          description: d.description ?? '',
        }))
    } catch { /* 換下一個來源 */ }
  }
  return []
}

function addDays(date: string, n: number) {
  const d = new Date(`${date}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}

export interface HolidayBlock { start: string; end: string; names: string[] }

/**
 * 連續假日區段：連續的放假日，且其中至少一天是國定假日／補假（有 description）。
 * 一般沒有節日的週六日不算（那是「週末」規則的範圍）。
 */
export function holidayBlocks(days: CalendarDay[]): HolidayBlock[] {
  const sorted = [...days].sort((a, b) => a.date.localeCompare(b.date))
  const blocks: HolidayBlock[] = []
  let cur: { start: string; end: string; names: string[] } | null = null
  for (const d of sorted) {
    if (d.isHoliday && cur && addDays(cur.end, 1) === d.date) {
      cur.end = d.date
      if (d.description) cur.names.push(d.description)
    } else if (d.isHoliday) {
      if (cur && cur.names.length) blocks.push(cur)
      cur = { start: d.date, end: d.date, names: d.description ? [d.description] : [] }
    } else {
      if (cur && cur.names.length) blocks.push(cur)
      cur = null
    }
  }
  if (cur && cur.names.length) blocks.push(cur)
  return blocks.map(b => ({ ...b, names: [...new Set(b.names.map(shortHolidayName))] }))
}

// 官方節日全名很長（例：臺灣光復暨金門古寧頭大捷紀念日），日曆格子放不下，顯示用簡稱
const SHORT_NAMES: Record<string, string> = {
  '開國紀念日': '元旦',
  '中華民國開國紀念日': '元旦',
  '農曆除夕': '除夕',
  '和平紀念日': '228',
  '兒童節': '兒童節',
  '民族掃墓節': '清明',
  '清明節': '清明',
  '孔子誕辰紀念日/教師節': '教師節',
  '臺灣光復暨金門古寧頭大捷紀念日': '台灣光復',
  '行憲紀念日': '行憲',
}

export function shortHolidayName(name: string): string {
  if (SHORT_NAMES[name]) return SHORT_NAMES[name]
  // 其他未列名稱：取「暨」「/」前段、去掉「紀念日」，最多 5 字
  const head = name.split(/[暨/／]/)[0].replace(/紀念日$/, '')
  return head.length > 5 ? head.slice(0, 5) : head
}

export interface HolidayNightOptions {
  /** 放假前一晚也算假日價（例如連假第一天前一晚） */
  include_eve?: boolean
  /** 連假最後一天那晚（隔天要上班）也算假日價 */
  include_last_night?: boolean
}

/**
 * 依使用者設定把連續假日區段轉成「要套假日價的入住晚」（以入住日期表示該晚）。
 * 區段內（第一天～最後一天前一晚）一律算；前一晚、最後一晚由使用者勾選。
 */
export function holidayNights(blocks: HolidayBlock[], opts: HolidayNightOptions): Map<string, string> {
  const nights = new Map<string, string>()
  for (const b of blocks) {
    const name = b.names.join(' ')
    for (let d = b.start; d < b.end; d = addDays(d, 1)) nights.set(d, name)
    if (opts.include_eve) nights.set(addDays(b.start, -1), name)
    if (opts.include_last_night) nights.set(b.end, name)
  }
  return nights
}

// ── 規則判斷 ─────────────────────────────────────────────────

export interface PropertyAdjustment { type: 'percent' | 'fixed'; value: number }

export interface CalendarRule {
  rule_type: string
  adjustment_type: string
  adjustment_value: number
  conditions: Record<string, unknown> | null
  property_id: string | null
  priority: number
  name?: string
}

/** 週末晚的星期（JS getDay：0=日…6=六，以入住那晚的日期判斷）。舊規則沒設定時沿用原本的六、日。 */
export function weekendDays(rule: CalendarRule): number[] {
  const d = rule.conditions?.weekend_days
  return Array.isArray(d) ? (d as number[]) : [0, 6]
}

/** 此規則對某房型的加價；全房型規則可在 conditions.property_adjustments 針對個別房型覆寫。 */
export function ruleAdjustmentFor(rule: CalendarRule, propertyId: string): PropertyAdjustment {
  const per = (rule.conditions?.property_adjustments as Record<string, PropertyAdjustment> | undefined)?.[propertyId]
  if (per && per.value != null && !Number.isNaN(Number(per.value))) {
    return { type: per.type === 'fixed' ? 'fixed' : 'percent', value: Number(per.value) }
  }
  return { type: rule.adjustment_type === 'percent' ? 'percent' : 'fixed', value: Number(rule.adjustment_value) }
}

/** 假日規則要套用的晚：國定假日行事曆（依選項）＋手動加入的日期－手動排除的日期。 */
export function ruleHolidayNights(rule: CalendarRule, calendars: Record<string, CalendarDay[]>): Map<string, string> {
  const c = rule.conditions ?? {}
  const country = (c.country as string) ?? ''
  const nights = country && calendars[country]
    ? holidayNights(holidayBlocks(calendars[country]), {
        include_eve: c.include_eve !== false,
        include_last_night: c.include_last_night === true,
      })
    : new Map<string, string>()
  for (const d of (c.dates as string[]) ?? []) if (!nights.has(d)) nights.set(d, rule.name || '自訂假日')
  for (const d of (c.exclude_dates as string[]) ?? []) nights.delete(d)
  return nights
}

/** 規則用到的國家行事曆（呼叫端據此決定要抓哪些資料）。 */
export function ruleCountries(rules: CalendarRule[]): string[] {
  return [...new Set(rules
    .filter(r => r.rule_type === 'holiday' && typeof r.conditions?.country === 'string' && r.conditions.country)
    .map(r => r.conditions!.country as string))]
}

export interface AppliedAdjustment { name: string; type: 'percent' | 'fixed'; value: number }

/**
 * 週末／假日／季節規則逐晚調整（住房率、早鳥等由呼叫端另外處理）。
 * 同一晚同時是週末與假日時只套假日規則，避免兩種加價疊加。
 */
export function applyCalendarRules(
  price: number,
  rules: CalendarRule[],
  date: string,
  propertyId: string,
  calendars: Record<string, CalendarDay[]>,
  holidayCache?: Map<CalendarRule, Map<string, string>>,
): { price: number; applied: AppliedAdjustment[] } {
  const dow = new Date(`${date}T00:00:00Z`).getUTCDay()
  const mmdd = date.slice(5)
  const relevant = rules
    .filter(r => r.property_id == null || r.property_id === propertyId)
    .sort((a, b) => b.priority - a.priority)

  const nightsOf = (r: CalendarRule) => {
    let m = holidayCache?.get(r)
    if (!m) { m = ruleHolidayNights(r, calendars); holidayCache?.set(r, m) }
    return m
  }
  const isHolidayNight = relevant.some(r => r.rule_type === 'holiday' && nightsOf(r).has(date))

  const applied: AppliedAdjustment[] = []
  let p = price
  for (const rule of relevant) {
    const c = rule.conditions ?? {}
    let applies = false
    let label = rule.name ?? ''
    switch (rule.rule_type) {
      case 'weekend': applies = !isHolidayNight && weekendDays(rule).includes(dow); break
      case 'holiday': {
        const n = nightsOf(rule).get(date)
        applies = n != null
        if (n) label = `${rule.name ?? ''}（${n}）`
        break
      }
      case 'seasonal': {
        const s = c.start_mmdd as string, e = c.end_mmdd as string
        applies = !!(s && e && mmdd >= s && mmdd <= e); break
      }
    }
    if (!applies) continue
    const adj = ruleAdjustmentFor(rule, propertyId)
    if (!adj.value) continue
    p = adj.type === 'percent' ? p * (1 + adj.value / 100) : p + adj.value
    applied.push({ name: label, type: adj.type, value: adj.value })
  }
  return { price: Math.max(0, Math.round(p)), applied }
}
