/**
 * POST /api/reserve/ai — 預約系統 AI 助理（真 AI，依實際用量扣點）
 *   action = 'smart_schedule'    { prompt }：讀店家真實服務、人員與未來 7 天空檔，推薦時段（只會從實際空檔中選）
 *   action = 'followup_sms'      { serviceName, customerName, staffName }：撰寫回訪關懷訊息
 *   action = 'capacity_analysis'：以近 30 天真實預約計算產能數據，AI 提出改善建議
 * 回傳格式與 lib/reserve/ai.ts 的型別相同。
 */
import { NextRequest, NextResponse } from 'next/server'
import { generateText } from 'ai'
import { createAnthropic } from '@ai-sdk/anthropic'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { chargeUsage, llmCost, precheckUsage } from '@/lib/marketing/billing'
import { computeAvailableSlots } from '@/lib/reserve/slots'
import type { CapacityAnalysisResult, FollowUpMessageResult, SmartScheduleResult } from '@/lib/reserve/ai'
import type { ReserveAppointment, ReserveService, ReserveStaff, ReserveStore } from '@/lib/reserve/types'

export const maxDuration = 60

const MODEL = 'claude-haiku-4-5'
const PRECHECK_USD = 0.02
const DAY_NAMES = ['日', '一', '二', '三', '四', '五', '六']
const DAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const

type Usage = { inputTokens?: number; outputTokens?: number }
type Util = 'optimal' | 'overloaded' | 'underutilized'

function parseJson<T>(text: string): T {
  const m = text.match(/\{[\s\S]*\}/)
  if (!m) throw new Error('AI 回覆格式錯誤，請再試一次')
  return JSON.parse(m[0]) as T
}

async function ask(system: string, prompt: string, maxOutputTokens = 1200): Promise<{ text: string; usage: Usage }> {
  const anthropic = createAnthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  const res = await generateText({ model: anthropic(MODEL), system, prompt, maxOutputTokens })
  return { text: res.text, usage: res.usage }
}

const localDate = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

const minutesOf = (a: ReserveAppointment) =>
  Math.max(0, (new Date(a.end_time).getTime() - new Date(a.start_time).getTime()) / 60000)

function toMinutes(t: string): number {
  const [h, m] = t.split(':').map(Number)
  return (h || 0) * 60 + (m || 0)
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const action = String(body.action ?? '')
  if (!['smart_schedule', 'followup_sms', 'capacity_analysis'].includes(action)) {
    return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  }

  const { data: storeRow } = await supabase.from('reserve_stores').select('*').eq('user_id', user.id).maybeSingle()
  if (!storeRow) return NextResponse.json({ error: '請先到「門市設定」建立店家，或套用產業範本' }, { status: 400 })
  const store = storeRow as ReserveStore

  const blocked = await precheckUsage(user.id, PRECHECK_USD)
  if (blocked) return NextResponse.json(blocked, { status: 402 })

  const admin = createAdminClient()
  const [{ data: services }, { data: staff }] = await Promise.all([
    admin.from('reserve_services').select('*').eq('store_id', store.id).eq('is_active', true),
    admin.from('reserve_staff').select('*').eq('store_id', store.id).eq('is_active', true),
  ])
  const svcList = (services ?? []) as ReserveService[]
  const staffList = (staff ?? []) as ReserveStaff[]
  const storeInfo = `店家：${store.name}（類別：${store.category}）`

  let costUsd = 0
  const track = (u: Usage) => { costUsd += llmCost(MODEL, u) }

  try {
    if (action === 'followup_sms') {
      const customerName = String(body.customerName ?? '').slice(0, 40) || '貴賓'
      const serviceName = String(body.serviceName ?? '').slice(0, 80)
      const staffName = String(body.staffName ?? '').slice(0, 40)
      if (!serviceName) return NextResponse.json({ error: '請填寫服務項目' }, { status: 400 })
      const { text, usage } = await ask(
        '你是服務業的顧客關懷專員，用繁體中文撰寫溫暖、專業、不誇大的回訪訊息。不可捏造療效、折扣或店家沒提供的資訊。只輸出 JSON。',
        [
          storeInfo,
          `客人：${customerName}`,
          `服務項目：${serviceName}`,
          `服務人員：${staffName || '（未指定）'}`,
          '',
          '請依服務性質寫一則服務後關懷訊息（含 1～3 點居家注意事項，100～200 字），並建議幾天後發送與管道。',
          '輸出：{"title":"標題","content":"訊息內容","suggestedSendAfterDays":數字,"channel":"LINE 或 SMS"}',
        ].join('\n'),
        800,
      )
      track(usage)
      const r = parseJson<FollowUpMessageResult>(text)
      const result: FollowUpMessageResult = { ...r, channel: r.channel === 'SMS' ? 'SMS' : 'LINE' }
      return NextResponse.json({ success: true, result })
    }

    if (action === 'capacity_analysis') {
      const since = new Date(Date.now() - 30 * 86400_000).toISOString()
      const { data: appts } = await admin.from('reserve_appointments')
        .select('start_time, end_time, status, staff_id').eq('store_id', store.id).gte('start_time', since)
      const active = ((appts ?? []) as ReserveAppointment[]).filter(a => a.status !== 'cancelled')

      // 近 30 天依營業時間的可服務分鐘數；已預約分鐘 ÷ 可服務分鐘 = 使用率
      let openMinutes = 0
      for (let i = 0; i < 30; i++) {
        const h = store.business_hours?.[DAY_KEYS[new Date(Date.now() - i * 86400_000).getDay()]]
        if (h && !h.closed) openMinutes += Math.max(0, toMinutes(h.close) - toMinutes(h.open))
      }
      const bookedMinutes = active.reduce((s, a) => s + minutesOf(a), 0)
      const capacity = openMinutes * Math.max(1, staffList.length)
      const occupancyRate = capacity ? Math.min(100, Math.round((bookedMinutes / capacity) * 100)) : 0
      const staffUtilization = staffList.map(s => {
        const mins = active.filter(a => a.staff_id === s.id).reduce((t, a) => t + minutesOf(a), 0)
        const rate = openMinutes ? Math.min(100, Math.round((mins / openMinutes) * 100)) : 0
        const status: Util = rate > 85 ? 'overloaded' : rate < 40 ? 'underutilized' : 'optimal'
        return { staffName: s.name, rate, status }
      })

      // 依星期與小時統計預約數，找出尖峰與離峰
      const buckets: Record<string, number> = {}
      for (const a of active) {
        const d = new Date(a.start_time)
        const k = `週${DAY_NAMES[d.getDay()]} ${String(d.getHours()).padStart(2, '0')}:00`
        buckets[k] = (buckets[k] ?? 0) + 1
      }
      const sorted = Object.entries(buckets).sort((a, b) => b[1] - a[1])
      const peakHours = sorted.slice(0, 3).map(([k]) => k).join('、') || '資料不足'
      const idleHours = sorted.length > 3 ? sorted.slice(-3).map(([k]) => k).join('、') : '資料不足'

      const stats = [
        `近 30 天有效預約 ${active.length} 筆，整體使用率約 ${occupancyRate}%`,
        `尖峰：${peakHours}`,
        `離峰：${idleHours}`,
        `人員使用率：${staffUtilization.map(s => `${s.staffName} ${s.rate}%`).join('、') || '無人員'}`,
        `服務項目：${svcList.map(s => `${s.name}（${s.duration_minutes} 分鐘、價格 ${s.sale_price ?? s.price}）`).join('、') || '無'}`,
      ].join('\n')
      const { text, usage } = await ask(
        '你是服務業營運顧問，用繁體中文根據實際數據給出具體、可執行的建議。數據不足時直接說明需要累積更多預約，不可捏造數字或百分比。只輸出 JSON。',
        `${storeInfo}\n${stats}\n\n請提出 3 點改善產能與營收的建議。輸出：{"aiRecommendations":["建議1","建議2","建議3"]}`,
        800,
      )
      track(usage)
      const r = parseJson<{ aiRecommendations?: string[] }>(text)
      const result: CapacityAnalysisResult = {
        occupancyRate, peakHours, idleHours, staffUtilization,
        aiRecommendations: (r.aiRecommendations ?? []).slice(0, 5),
      }
      return NextResponse.json({ success: true, result })
    }

    // smart_schedule：AI 先判斷要預約的服務，再以真實空檔算出可選時段，最後 AI 只能從中挑選推薦
    const prompt = String(body.prompt ?? '').slice(0, 500)
    if (!prompt) return NextResponse.json({ error: '請描述客人的需求' }, { status: 400 })
    if (!svcList.length) return NextResponse.json({ error: '請先建立服務項目' }, { status: 400 })

    const pick = await ask(
      '從清單中選出客人要預約的服務，只輸出 JSON。',
      `服務清單：\n${svcList.map(s => `${s.id}｜${s.name}`).join('\n')}\n\n客人需求：${prompt}\n\n輸出：{"serviceIds":["id"]}（最多 2 個，必須是清單中的 id；判斷不出來就選最接近的 1 個）`,
      200,
    )
    track(pick.usage)
    const ids = (parseJson<{ serviceIds?: string[] }>(pick.text).serviceIds ?? [])
      .filter(id => svcList.some(s => s.id === id)).slice(0, 2)
    const chosen = ids.length ? svcList.filter(s => ids.includes(s.id)) : [svcList[0]]

    const { data: appts } = await admin.from('reserve_appointments').select('*').eq('store_id', store.id)
      .gte('start_time', new Date().toISOString())
    const lines: string[] = []
    for (const svc of chosen) {
      for (let i = 0; i < 7; i++) {
        const d = new Date(Date.now() + i * 86400_000)
        const slots = computeAvailableSlots({
          dateStr: localDate(d), store, service: svc, staffList,
          appointments: (appts ?? []) as ReserveAppointment[],
        }).filter(s => s.available)
        if (slots.length) {
          const times = slots.slice(0, 24).map(s => `${s.time}${s.staffName ? `@${s.staffName}` : ''}`).join('、')
          lines.push(`${svc.name}｜${localDate(d)}（週${DAY_NAMES[d.getDay()]}）：${times}`)
        }
      }
    }
    if (!lines.length) {
      const empty: SmartScheduleResult = { analysis: '未來 7 天沒有可預約的空檔，請確認營業時間、人員班表與服務設定。', recommendedSlots: [] }
      return NextResponse.json({ success: true, result: empty })
    }
    const { text, usage } = await ask(
      '你是預約櫃台助理，用繁體中文回覆。只能從提供的可預約時段中挑選，不可自行編造時段或人員。只輸出 JSON。',
      [
        storeInfo,
        `客人需求：${prompt}`,
        '',
        '可預約時段（服務｜日期：時間@人員）：',
        ...lines,
        '',
        '請挑 2～3 個最符合需求的時段。輸出：{"analysis":"一句說明","recommendedSlots":[{"date":"YYYY-MM-DD（週X）","time":"HH:mm","staffName":"人員或「不指定」","reason":"推薦原因"}]}',
      ].join('\n'),
      900,
    )
    track(usage)
    const r = parseJson<SmartScheduleResult>(text)
    const result: SmartScheduleResult = { analysis: r.analysis ?? '', recommendedSlots: (r.recommendedSlots ?? []).slice(0, 3) }
    return NextResponse.json({ success: true, result })
  } catch (err) {
    console.error('[reserve-ai]', err)
    return NextResponse.json({ error: err instanceof Error ? err.message : 'AI 助理暫時無法使用' }, { status: 500 })
  } finally {
    if (costUsd > 0) await chargeUsage(user.id, costUsd, `[reserve] AI 助理（${action}）`).catch(() => {})
  }
}
