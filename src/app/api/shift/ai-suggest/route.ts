import { NextRequest, NextResponse } from 'next/server'
import { generateText } from 'ai'
import { createAnthropic } from '@ai-sdk/anthropic'
import { getShiftContext, storeAllowed } from '@/lib/shift/scope'
import { isFulltime, pgQuote } from '@/lib/shift/staff'
import { hourlyProfile } from '@/lib/shift/sales'
import {
  SLOT_MIN, availableOn, fmtMin, isDate, listDates, needsOn, parseHHMM, weekdayOf,
  type AvailRule, type NeedRule,
} from '@/lib/shift/time'
import { outputLangInstruction } from '@/lib/ai/output-lang'
import { trackAiUsage } from '@/lib/ai/universal-tracker'

export const maxDuration = 120
const MODEL = 'claude-sonnet-4-6'
const WD = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

interface AiPlan { e: number; date: string; start: string; end: string; reason?: string }
interface AiNeed { weekdays?: number[]; start: string; end: string; headcount: number }
interface AiOut { summary?: string; staffing_advice?: string; suggested_needs?: AiNeed[]; plans?: AiPlan[] }

// 從可上班時段、人力需求、既有班表與近 8 週每小時業績，請 AI 建議班表。body: { store, from, to }（最多 14 天）
export async function POST(req: NextRequest) {
  const ctx = await getShiftContext()
  if (!ctx.ok) return NextResponse.json({ error: ctx.status === 401 ? 'Unauthorized' : 'Forbidden' }, { status: ctx.status })
  if (!process.env.ANTHROPIC_API_KEY) return NextResponse.json({ error: 'AI 未設定（ANTHROPIC_API_KEY）' }, { status: 503 })
  const b = await req.json().catch(() => ({}))
  const store = String(b.store ?? '').trim(), from = String(b.from ?? ''), to = String(b.to ?? '')
  if (!store || !isDate(from) || !isDate(to) || to < from) return NextResponse.json({ error: '參數錯誤' }, { status: 400 })
  if ((Date.parse(to) - Date.parse(from)) / 86400000 > 13) return NextResponse.json({ error: '一次最多 14 天' }, { status: 400 })
  if (!storeAllowed(ctx, store)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const db = ctx.admin, owner = ctx.ownerId

  const [{ data: emps }, { data: rules }, { data: plans }, { data: needs }, sales] = await Promise.all([
    db.from('hr_employees').select('id, name, employment_type, staff_category, position').eq('owner_id', owner).eq('status', 'active')
      .or(`store.eq.${pgQuote(store)},managed_stores.cs.{${pgQuote(store)}}`).order('name'),
    db.from('shift_avail_rules').select('id, employee_id, start_date, end_date, weekdays, start_min, end_min')
      .eq('owner_id', owner).eq('store', store).lte('start_date', to).gte('end_date', from),
    db.from('shift_plans').select('employee_id, work_date, start_min, end_min, store')
      .eq('owner_id', owner).gte('work_date', from).lte('work_date', to),
    db.from('shift_needs').select('id, weekdays, start_min, end_min, headcount').eq('owner_id', owner).eq('store', store),
    hourlyProfile(db, owner, store, from),
  ])
  const staff = emps ?? []
  if (staff.length === 0) return NextResponse.json({ error: '此門市沒有在職員工' }, { status: 400 })
  const R = (rules ?? []) as AvailRule[]
  const N = (needs ?? []) as NeedRule[]
  const P = plans ?? []
  const dates = listDates(from, to)
  // 正職：06:00–24:00 皆可排，除了期待休假日；工讀：依可上班時段
  const { data: offs } = await db.from('shift_dayoff_requests').select('employee_id, off_date')
    .eq('owner_id', owner).in('employee_id', staff.map(e => e.id)).gte('off_date', from).lte('off_date', to)
  const offSet = new Set((offs ?? []).map(o => `${o.employee_id}|${o.off_date}`))
  const availFor = (e: { id: string; staff_category?: string | null; employment_type?: string | null }, d: string) =>
    isFulltime(e) ? (offSet.has(`${e.id}|${d}`) ? [] : [{ start: 6 * 60, end: 24 * 60 }]) : availableOn(R, e.id, d)
  const idx = new Map(staff.map((e, i) => [e.id, i]))

  // 精簡資料給 AI（員工以編號表示，避免回傳不存在的 id）
  const input = {
    store, slot_minutes: SLOT_MIN,
    staff: staff.map((e, i) => ({ e: i, name: e.name, type: isFulltime(e) ? 'full-time' : 'part-time', position: e.position || undefined })),
    days: dates.map(d => {
      const need = needsOn(N, d)
      return {
        date: d, weekday: WD[weekdayOf(d)],
        available: staff.map((e, i) => ({ e: i, times: availFor(e, d).map(iv => `${fmtMin(iv.start)}-${fmtMin(iv.end)}`) })).filter(x => x.times.length),
        requested_day_off: staff.map((e, i) => offSet.has(`${e.id}|${d}`) ? i : -1).filter(i => i >= 0),
        already_scheduled: P.filter(p => p.work_date === d && idx.has(p.employee_id))
          .map(p => ({ e: idx.get(p.employee_id), time: `${fmtMin(p.start_min)}-${fmtMin(p.end_min)}`, store: p.store })),
        needs: [...need.entries()].map(([m, n]) => `${fmtMin(m)}:${n}`).join(' ') || undefined,
      }
    }),
    hourly_sales_avg_last_8_weeks: sales.days
      ? { days_with_data: sales.days, by_weekday_hour: sales.stats.map(s => ({ wd: WD[s.weekday], h: s.hour, orders: s.orders, cups: s.cups, revenue: s.revenue })) }
      : 'no data',
  }

  const locale = req.cookies.get('locale')?.value ?? 'zh-TW'
  const prompt = `You are a scheduling assistant for a bubble-tea store. Build a draft shift schedule for ${from} ~ ${to}.

Rules (must follow):
1. Only schedule a person inside one of their "available" times for that date. Start and end must be on ${SLOT_MIN}-minute boundaries and within the available range.
2. Never overlap with "already_scheduled" for the same person (any store); do not repeat existing shifts.
3. Prefer one continuous shift per person per day, 3–8 hours; part-time usually 3–5 hours, full-time about 8 hours. Full-time staff appear available 06:00-24:00 except on their requested_day_off dates, where they must not be scheduled; give full-time staff roughly 5–6 working days per week.
4. Meet "needs" (time:headcount per ${SLOT_MIN}-minute slot) when possible. If needs are missing, infer staffing from hourly sales (busier hours need more people; at least 1 person whenever someone is available during likely opening hours).
5. Balance total hours fairly across staff.
6. If sales data exists, propose "suggested_needs" (weekday groups, time ranges, headcount) derived from it; otherwise return an empty array.

Data (JSON):
${JSON.stringify(input)}

Reply with JSON only, no markdown:
{"summary":"2-4 sentences: coverage result and any gaps","staffing_advice":"short advice based on sales and availability","suggested_needs":[{"weekdays":[1,2,3,4,5],"start":"HH:MM","end":"HH:MM","headcount":2}],"plans":[{"e":0,"date":"YYYY-MM-DD","start":"HH:MM","end":"HH:MM","reason":"short"}]}
weekdays use 0=Sun..6=Sat.${outputLangInstruction(locale)}`

  let text = ''
  try {
    const anthropic = createAnthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
    const res = await generateText({ model: anthropic(MODEL), prompt, maxOutputTokens: 8000, temperature: 0.2 })
    text = res.text
    const u = res.usage as { inputTokens?: number; outputTokens?: number } | undefined
    void trackAiUsage({ feature: 'store_coach', modelId: MODEL, inputTokens: Number(u?.inputTokens ?? 0), outputTokens: Number(u?.outputTokens ?? 0), metadata: { kind: 'shift_suggest', store } })
  } catch (e) {
    return NextResponse.json({ error: `AI 失敗：${e instanceof Error ? e.message : String(e)}` }, { status: 502 })
  }

  let out: AiOut
  try {
    const s = text.replace(/```json/gi, '').replace(/```/g, '').trim()
    out = JSON.parse(s.slice(s.indexOf('{'), s.lastIndexOf('}') + 1))
  } catch {
    return NextResponse.json({ error: 'AI 回傳格式錯誤，請再試一次' }, { status: 502 })
  }

  // 驗證：必須在可上班時段內、對齊格子、不與既有班或其他建議重疊
  const taken = new Map<string, { s: number; e: number }[]>()
  for (const p of P) (taken.get(`${p.employee_id}|${p.work_date}`) ?? taken.set(`${p.employee_id}|${p.work_date}`, []).get(`${p.employee_id}|${p.work_date}`)!).push({ s: p.start_min, e: p.end_min })
  const proposals: { employee_id: string; name: string; work_date: string; start_min: number; end_min: number; reason: string }[] = []
  let rejected = 0
  for (const p of Array.isArray(out.plans) ? out.plans : []) {
    const emp = staff[Number(p.e)]
    const s = parseHHMM(p.start), e = parseHHMM(p.end)
    const ok = emp && dates.includes(p.date) && s != null && e != null && e > s && s % SLOT_MIN === 0 && e % SLOT_MIN === 0
      && availFor(emp, p.date).some(iv => iv.start <= s! && iv.end >= e!)
    const k = emp ? `${emp.id}|${p.date}` : ''
    if (!ok || (taken.get(k) ?? []).some(x => x.s < e! && x.e > s!)) { rejected++; continue }
    ;(taken.get(k) ?? taken.set(k, []).get(k)!).push({ s: s!, e: e! })
    proposals.push({ employee_id: emp.id, name: emp.name, work_date: p.date, start_min: s!, end_min: e!, reason: String(p.reason ?? '').slice(0, 200) })
  }
  const suggested_needs = (Array.isArray(out.suggested_needs) ? out.suggested_needs : []).map(n => ({
    weekdays: (Array.isArray(n.weekdays) ? n.weekdays : []).map(Number).filter(x => Number.isInteger(x) && x >= 0 && x <= 6),
    start_min: parseHHMM(n.start), end_min: parseHHMM(n.end), headcount: Math.round(Number(n.headcount)),
  })).filter(n => n.start_min != null && n.end_min != null && n.end_min > n.start_min && n.start_min % SLOT_MIN === 0 && n.end_min % SLOT_MIN === 0 && n.headcount >= 0 && n.headcount <= 50)

  return NextResponse.json({
    summary: String(out.summary ?? ''), staffing_advice: String(out.staffing_advice ?? ''),
    suggested_needs, proposals, rejected,
    sales_days: sales.days,
  })
}
