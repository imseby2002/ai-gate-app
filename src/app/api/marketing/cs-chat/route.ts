/**
 * POST /api/marketing/cs-chat
 * 客服 AI 路由引擎
 *
 * 流程：
 *   1. Gemini Flash 分類意圖（intent）+ 風險等級（risk: low/medium/high）
 *   2. 若 risk >= escalationThreshold → Claude Sonnet 生成深度回覆
 *   3. 否則 Gemini Flash 直接生成回覆
 *
 * Body: {
 *   message: string               // 客戶訊息
 *   history?: { role, content }[] // 對話歷史（最近 N 輪）
 *   campaignId?: string
 *   knowledgeBase?: string        // 知識庫文字
 *   escalationThreshold?: 'medium' | 'high'  // 預設 'high'
 *   language?: string             // 回覆語言（預設 auto-detect）
 * }
 *
 * Response: {
 *   reply: string
 *   intent: string
 *   risk: 'low' | 'medium' | 'high'
 *   provider: 'Gemini' | 'Claude'
 *   latencyMs: number
 * }
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAnthropic } from '@ai-sdk/anthropic'
import { createGoogleGenerativeAI } from '@ai-sdk/google'
import { generateText } from 'ai'

const INTENT_CATEGORIES = [
  '產品諮詢',
  '價格/報價',
  '訂單查詢',
  '退換貨/退款',
  '技術支援',
  '投訴/抱怨',
  '帳號/登入問題',
  '一般問候',
  '法律/合約',
  '其他',
]

const HIGH_RISK_INTENTS = ['退換貨/退款', '投訴/抱怨', '法律/合約']

export async function POST(req: NextRequest) {
  try {
    return await handlePost(req)
  } catch (e) {
    return NextResponse.json({ error: `伺服器錯誤：${String(e)}` }, { status: 500 })
  }
}

async function handlePost(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const {
    message,
    history = [],
    knowledgeBase = '',
    escalationThreshold = 'high',
    language = 'auto',
    campaignId,
  } = await req.json()

  if (!message?.trim()) return NextResponse.json({ error: '訊息不可為空' }, { status: 400 })

  const t0 = Date.now()
  const geminiKey = process.env.GOOGLE_AI_API_KEY
  if (!geminiKey) return NextResponse.json({ error: 'GOOGLE_AI_API_KEY 未設定' }, { status: 500 })

  const google = createGoogleGenerativeAI({ apiKey: geminiKey })

  // ── Step 1: Gemini intent classification ─────────────────────────────────
  const knowledgeSection = knowledgeBase
    ? `\n\n【知識庫】\n${knowledgeBase.slice(0, 3000)}`
    : ''

  const classifyPrompt = `你是一個客服意圖分類器。請分析以下客戶訊息，回傳 JSON（只回傳 JSON，不要有其他文字）：

意圖類別（從中選一）：${INTENT_CATEGORIES.join('、')}
風險等級：low（一般諮詢）/ medium（需要人工協助）/ high（投訴、退款、法律）${knowledgeSection}

客戶訊息：「${message}」

回傳格式：{"intent":"...","risk":"low|medium|high","summary":"一句話摘要客戶需求"}`

  let intent = '其他'
  let risk: string = 'low'
  let summary = message

  try {
    const { text: classifyText } = await generateText({
      model: google('gemini-2.5-flash'),
      messages: [{ role: 'user', content: classifyPrompt }],
    })
    const parsed = JSON.parse(classifyText.replace(/```json\n?|```/g, '').trim())
    intent = parsed.intent ?? intent
    risk = parsed.risk ?? risk
    summary = parsed.summary ?? summary

    // Force high risk for certain intents
    if (HIGH_RISK_INTENTS.includes(intent)) risk = 'high'
  } catch (_) {
    // Keep defaults on parse failure
  }

  // ── Step 2: Determine provider ────────────────────────────────────────────
  const shouldEscalate =
    risk === 'high' ||
    (escalationThreshold === 'medium' && (risk === 'medium' || risk === 'high'))

  const langInstruction = language === 'auto'
    ? '請使用與客戶相同的語言回覆。'
    : `請使用 ${language} 回覆。`

  const systemPrompt = `你是一個專業的客服 AI 助理，代表公司提供售後支援。
${langInstruction}
回覆要求：
- 語氣親切、專業，避免過於制式
- 簡潔明瞭，重點在解決客戶問題
- 若需要人工介入，請告知客戶將安排專員跟進
- 不要捏造資訊，若不確定請誠實告知${knowledgeBase ? `\n\n知識庫參考：\n${knowledgeBase.slice(0, 4000)}` : ''}`

  const msgHistory = [
    ...history.slice(-6).map((h: { role: string; content: string }) => ({
      role: h.role as 'user' | 'assistant',
      content: h.content,
    })),
    { role: 'user' as const, content: message },
  ]

  let reply = ''
  let provider: 'Gemini' | 'Claude' = 'Gemini'

  if (shouldEscalate) {
    // ── Claude for high-risk ───────────────────────────────────────────────
    const anthropicKey = process.env.ANTHROPIC_API_KEY
    if (!anthropicKey) {
      provider = 'Gemini'
    } else {
      provider = 'Claude'
      try {
        const anthropic = createAnthropic({ apiKey: anthropicKey })
        const { text } = await generateText({
          model: anthropic('claude-sonnet-4-5'),
          system: systemPrompt,
          messages: msgHistory,
        })
        reply = text
      } catch {
        provider = 'Gemini' // fallback to Gemini on Claude error
      }
    }
  }

  if (provider === 'Gemini') {
    try {
      const { text } = await generateText({
        model: google('gemini-2.5-flash'),
        system: systemPrompt,
        messages: msgHistory,
      })
      reply = text
    } catch (e) {
      return NextResponse.json({ error: `Gemini 呼叫失敗：${String(e).slice(0, 200)}` }, { status: 500 })
    }
  }

  const latencyMs = Date.now() - t0

  // Optionally save log to Supabase
  if (campaignId) {
    await supabase.from('marketing_campaigns').select('id').eq('id', campaignId).single().then(async ({ data }) => {
      if (!data) return
      // Append to cs_logs in unit_data[12]
      const { data: camp } = await supabase.from('marketing_campaigns').select('unit_data').eq('id', campaignId).single()
      const unitData = (camp?.unit_data ?? {}) as Record<string, unknown>
      const unit12 = (unitData[12] as { logs?: unknown[] } | undefined) ?? {}
      const logs = (unit12.logs ?? []) as unknown[]
      const newLog = { message, reply, intent, risk, provider, latencyMs, ts: new Date().toISOString() }
      const updatedLogs = [newLog, ...logs].slice(0, 100) // keep latest 100
      await supabase.from('marketing_campaigns').update({
        unit_data: { ...unitData, 12: { ...unit12, logs: updatedLogs } },
      }).eq('id', campaignId)
    })
  }

  return NextResponse.json({ reply, intent, risk, provider, latencyMs, summary })
}
