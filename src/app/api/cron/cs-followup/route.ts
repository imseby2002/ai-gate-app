/**
 * GET /api/cron/cs-followup  （Vercel Cron，每 30 分鐘）
 *
 * 自動跟進：對「私訊詢問後就沒下文、尚未成交」的客人，在 24 小時客服窗口內
 * 主動送一則跟進訊息。只針對 Meta 三平台（Messenger / Instagram / WhatsApp），
 * 因為這些平台有 24h 窗口、且不像 LINE 主動 push 會逐則計費。
 *
 * 合規/防擾：
 *  - 只在租戶於設定頁「開啟自動跟進」（cs_data_sources type=auto_followup, enabled）時才處理。
 *  - 只在客人最後一則訊息距今 8～22 小時（有間隔、且仍在 24h 窗口內）才送。
 *  - 每位客人每平台「只跟進一次」（cs_followups 去重）。
 *  - 已下單（新訂單待跟進工單）或真人接管中（人工客服請求未結）→ 不跟進。
 */
import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendToCustomer } from '@/lib/cs/send'
import { createAnthropic } from '@ai-sdk/anthropic'
import { generateText } from 'ai'

const META_PLATFORMS = ['messenger', 'instagram', 'whatsapp']
const WINDOW_MIN_H = 8   // 至少距上次訊息 8 小時
const WINDOW_MAX_H = 22  // 最多 22 小時（保留緩衝，確保仍在 24h 窗口內）
const MAX_PER_RUN = 60   // 單次 cron 上限，避免爆量

type RunResult = { userId: string; platform: string; fromId: string; ok: boolean; error?: string }

export async function GET(req: Request) {
  // 與其他 cron 一致的驗證
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

  const supabase = createAdminClient()
  const now = Date.now()
  const latest = new Date(now - WINDOW_MIN_H * 3600_000).toISOString()  // last_message_at <= now-8h
  const earliest = new Date(now - WINDOW_MAX_H * 3600_000).toISOString() // last_message_at >= now-22h

  // 1. 已開啟自動跟進的租戶
  const { data: cfgs } = await supabase
    .from('cs_data_sources')
    .select('user_id')
    .eq('type', 'auto_followup')
    .eq('enabled', true)
  const tenants = cfgs ?? []
  if (!tenants.length) return NextResponse.json({ tenants: 0, sent: 0 })

  const anthropic = createAnthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })
  const results: RunResult[] = []
  let sent = 0

  for (const t of tenants) {
    if (sent >= MAX_PER_RUN) break
    const userId = t.user_id as string

    // 只處理已連線的 Meta 平台（避免對沒憑證的平台白跑、白花 AI 生成）
    const { data: creds } = await supabase
      .from('social_platform_credentials')
      .select('platform')
      .eq('user_id', userId)
      .eq('is_connected', true)
      .in('platform', META_PLATFORMS)
    const connected = [...new Set((creds ?? []).map(c => c.platform as string))]
    if (!connected.length) continue

    // 候選客人：最後訊息落在 8～22h 窗口
    const { data: candidates } = await supabase
      .from('cs_customers')
      .select('platform, from_id, name, summary, stage, industry')
      .eq('user_id', userId)
      .in('platform', connected)
      .gte('last_message_at', earliest)
      .lte('last_message_at', latest)
      .limit(200)

    for (const c of candidates ?? []) {
      if (sent >= MAX_PER_RUN) break
      const platform = c.platform as string
      const fromId = c.from_id as string
      if (!fromId) continue

      // 已成交階段 → 跳過
      if (['won', 'booked', 'completed', 'closed'].includes(String(c.stage ?? ''))) continue

      // 已跟進過 → 跳過
      const { data: dup } = await supabase
        .from('cs_followups')
        .select('id').eq('user_id', userId).eq('platform', platform).eq('from_id', fromId).limit(1)
      if (dup?.length) continue

      // 已下單或真人接管中 → 跳過
      const { data: tks } = await supabase
        .from('cs_tickets')
        .select('intent, status')
        .eq('user_id', userId).eq('from_id', fromId)
        .in('intent', ['新訂單待跟進', '人工客服請求'])
        .limit(5)
      if ((tks ?? []).some(x => x.intent === '新訂單待跟進')) continue
      if ((tks ?? []).some(x => x.intent === '人工客服請求' && ['open', 'in_progress'].includes(String(x.status)))) continue

      // 近期對話脈絡
      const { data: msgs } = await supabase
        .from('cs_messages')
        .select('message, reply, created_at')
        .eq('user_id', userId).eq('platform', platform).eq('from_id', fromId)
        .order('created_at', { ascending: false }).limit(4)
      const convo = (msgs ?? []).reverse()
        .map(m => `客人：${m.message ?? ''}${m.reply ? `\n客服：${m.reply}` : ''}`).join('\n')

      // 生成跟進訊息（Haiku，省成本）
      let text = ''
      try {
        const { text: gen } = await generateText({
          model: anthropic('claude-haiku-4-5'),
          system: '你是店家的客服助理。客人先前私訊詢問後就沒有再回覆。請寫一則「主動跟進」訊息：溫暖、簡短（1–3 句、繁體中文），不用罐頭稱呼；依對話脈絡提供一個具體誘因，或問一個能推進決定的問題，最後用二選一或輕鬆的邀請收尾。不要提到「系統」「自動」，像真人客服關心即可。只輸出訊息本身。',
          prompt: `客戶稱呼：${c.name || '（未知，勿硬加稱呼）'}\n背景摘要：${c.summary || '（無）'}\n\n近期對話：\n${convo || '（無紀錄）'}\n\n請寫跟進訊息：`,
          maxOutputTokens: 300,
        })
        text = gen.trim()
      } catch { continue }
      if (!text) continue

      const r = await sendToCustomer(userId, platform, fromId, text)
      if (r.ok) {
        await supabase.from('cs_followups').insert({ user_id: userId, platform, from_id: fromId, message: text })
        try {
          await supabase.from('cs_messages').insert({
            user_id: userId, industry: c.industry ?? 'homestay', platform, from_id: fromId,
            message: '【自動跟進】', reply: text,
          })
        } catch { /* 記錄失敗不影響已送出的跟進 */ }
        sent++
        results.push({ userId, platform, fromId, ok: true })
      } else {
        results.push({ userId, platform, fromId, ok: false, error: r.error })
      }
    }
  }

  return NextResponse.json({ tenants: tenants.length, sent, results: results.slice(0, 50) })
}
