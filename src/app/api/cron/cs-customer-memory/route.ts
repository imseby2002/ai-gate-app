/**
 * GET /api/cron/cs-customer-memory （Vercel Cron，每 30 分鐘）
 *
 * 背景彙整客戶對話記憶：把每位客人的對話摘要成 2-4 句話（意圖、偏好、已提過的
 * 特殊需求、尚待處理的事）寫回 cs_customers.summary，讓 AI 之後回覆時（見
 * buildSellSection）能直接引用，不用每次都重新從頭讀完整對話、也不會忘記客人
 * 之前講過的事。
 *
 * 身分事實（訂單號碼/電話/訂房大名）不在這裡處理——那些在查詢成功比對到訂單的
 * 當下就直接寫進 cs_customers.facts 了（見 cs-webhook route 的 saveConfirmedFacts），
 * 不需要、也不應該透過 LLM 生成（那是需要 100% 準確的識別資料，不是摘要）。
 *
 * 只挑「有新訊息但還沒重新彙整過」且「最近沒有新訊息進來」（避免對話還在進行中
 * 就頻繁重新彙整、浪費 AI 呼叫）的客人，一次 cron 上限一批，分散在多次執行完成。
 */
import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createAnthropic } from '@ai-sdk/anthropic'
import { generateText } from 'ai'

const IDLE_MIN = 10      // 距最後一則訊息至少 10 分鐘，避免對話進行中被打斷重新彙整
const LOOKBACK_DAYS = 14 // 太久沒互動的客人不用再花錢彙整
const MAX_PER_RUN = 40

export async function GET(req: Request) {
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret) {
    if (req.headers.get('authorization') !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  } else {
    const isVercelCron = req.headers.get('x-vercel-cron') === '1'
    const isLocalhost = req.headers.get('host')?.startsWith('localhost')
    if (!isVercelCron && !isLocalhost) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  const anthropicKey = process.env.ANTHROPIC_API_KEY
  if (!anthropicKey) return NextResponse.json({ error: 'ANTHROPIC_API_KEY not set' }, { status: 503 })
  const anthropic = createAnthropic({ apiKey: anthropicKey })

  const supabase = createAdminClient()
  const now = Date.now()
  const idleCutoff = new Date(now - IDLE_MIN * 60_000).toISOString()
  const lookbackCutoff = new Date(now - LOOKBACK_DAYS * 24 * 3600_000).toISOString()

  // 候選：有過對話、最後一則訊息在「夠久之前～查找範圍內」（已經算安靜下來），
  // 且從沒彙整過，或彙整之後又有新訊息進來。
  const { data: candidates } = await supabase
    .from('cs_customers')
    .select('id, user_id, platform, from_id, industry, name, message_count, summarized_at, last_message_at')
    .gte('last_message_at', lookbackCutoff)
    .lte('last_message_at', idleCutoff)
    .gte('message_count', 2)
    .order('last_message_at', { ascending: false })
    .limit(300)

  const rows = (candidates ?? []).filter(c => {
    if (!c.summarized_at) return true
    return new Date(c.last_message_at as string).getTime() > new Date(c.summarized_at as string).getTime()
  }).slice(0, MAX_PER_RUN)

  let updated = 0
  const errors: string[] = []

  for (const c of rows) {
    try {
      const { data: msgs } = await supabase
        .from('cs_messages')
        .select('message, reply, created_at')
        .eq('user_id', c.user_id).eq('platform', c.platform).eq('from_id', c.from_id)
        .order('created_at', { ascending: false })
        .limit(20)
      const convo = (msgs ?? []).reverse()
        .map(m => `客人：${m.message ?? ''}${m.reply ? `\n客服：${m.reply}` : ''}`).join('\n')
      if (!convo.trim()) continue

      const { text } = await generateText({
        model: anthropic('claude-haiku-4-5'),
        system: '你是客服系統的內部工具，負責把客人對話摘要成給下一位客服（AI 或真人）看的簡短背景筆記。只寫「事實」，不要猜測、不要編造。輸出 2-4 句繁體中文，涵蓋：客人是誰/什麼身份（若有提及）、已經表達過的偏好或特殊需求、目前對話進行到哪個階段或還有什麼事沒解決。不要包含訂單號碼、電話、密碼等識別資訊或敏感資料（那些另有機制記錄）。沒有值得記的內容就輸出「無特別事項」。只輸出摘要本身，不要加任何前綴或標題。',
        prompt: `客戶稱呼：${c.name || '（未知）'}\n\n對話紀錄：\n${convo.slice(-4000)}\n\n請寫摘要：`,
        maxOutputTokens: 200,
      })
      const summary = text.trim()
      if (!summary) continue

      await supabase.from('cs_customers').update({
        summary,
        summarized_at: new Date().toISOString(),
      }).eq('id', c.id)
      updated++
    } catch (e) {
      errors.push(`${c.user_id}/${c.platform}/${c.from_id}: ${e instanceof Error ? e.message : String(e)}`)
    }
  }

  return NextResponse.json({ candidates: rows.length, updated, errors: errors.slice(0, 20) })
}
