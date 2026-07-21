// CS AI 回覆的共用路由邏輯，供 cs-chat（測試分頁）與 cs-webhook（正式頻道）共用，
// 避免兩處各自維護造成行為走鐘。
//
// L1 分流：Groq Llama 3.1 8B 快速判斷意圖/風險（取代已排定下線的 gemini-2.5-flash）
// L2 常規：Groq Qwen3 32B 為主力生成繁中回覆，免費通道／直連依序備援
// 每一步都走「免費資源優先，付費墊底」：Groq 免費層 → CLIProxy → FreeLLM → 直連 Gemini
import { generateText, type ModelMessage } from 'ai'
import { createGroq } from '@ai-sdk/groq'
import { createGoogleGenerativeAI } from '@ai-sdk/google'

export type ChatMsg = ModelMessage

interface FreeChainEntry {
  url: string
  key: string
  model: string
  label: string
}

// 免費通道優先序：CLIProxy → FreeLLM（依使用者指定順序）
function freeChain(model: string): FreeChainEntry[] {
  const cliProxyUrl = process.env.CLI_PROXY_API_URL ?? process.env.NEXT_PUBLIC_CLI_PROXY_API_URL
  const freeLlmUrl = process.env.FREE_LLM_URL ?? process.env.NEXT_PUBLIC_FREE_LLM_URL
  return [
    ...(cliProxyUrl
      ? [{ url: cliProxyUrl, key: process.env.CLI_PROXY_API_KEY ?? 'no-key', model, label: 'CLIProxy' }]
      : []),
    ...(process.env.FREE_LLM_API_KEY && freeLlmUrl
      ? [{ url: freeLlmUrl, key: process.env.FREE_LLM_API_KEY, model: 'auto', label: 'FreeLLM' }]
      : []),
  ]
}

async function tryOpenAiCompat(entry: FreeChainEntry, system: string | undefined, messages: ChatMsg[]): Promise<string | null> {
  try {
    const { createOpenAI } = await import('@ai-sdk/openai')
    const openaiCompat = createOpenAI({ apiKey: entry.key, baseURL: entry.url })
    const { text } = await generateText({
      model: openaiCompat.chat(entry.model),
      ...(system ? { system } : {}),
      messages,
      maxOutputTokens: 2048,
      abortSignal: AbortSignal.timeout(20000),
    })
    return text || null
  } catch {
    return null
  }
}

// 直連 Gemini 的最後保命備援。gemini-2.5-flash 已排定 2026/10/16 下線，一律改用 gemini-3.1-flash-lite。
function directGemini() {
  const geminiKey = process.env.GOOGLE_AI_API_KEY
  if (!geminiKey) return null
  return createGoogleGenerativeAI({ apiKey: geminiKey })('gemini-3.1-flash-lite')
}

// ── L1：意圖/風險分流（Groq 8B 為主，快速判斷用不到大模型）───────────────────
export interface ClassifyResult {
  intent: string
  risk: 'low' | 'medium' | 'high'
  summary: string
}

export async function classifyIntentL1(
  message: string,
  intentCategories: string[],
  knowledgeSection: string,
): Promise<ClassifyResult> {
  const prompt = `你是一個客服意圖分類器。請分析以下客戶訊息，回傳 JSON（只回傳 JSON，不要有其他文字）：

意圖類別（從中選一）：${intentCategories.join('、')}
風險等級：low（一般諮詢）/ medium（需要人工協助）/ high（投訴、退款、法律）${knowledgeSection}

客戶訊息：「${message}」

回傳格式：{"intent":"...","risk":"low|medium|high","summary":"一句話摘要客戶需求"}`

  const fallbackResult: ClassifyResult = { intent: '其他', risk: 'low', summary: message }

  const parse = (text: string): ClassifyResult | null => {
    try {
      const parsed = JSON.parse(text.replace(/```json\n?|```/g, '').trim())
      if (!parsed.intent) return null
      return {
        intent: parsed.intent,
        risk: (['low', 'medium', 'high'].includes(parsed.risk) ? parsed.risk : 'low') as ClassifyResult['risk'],
        summary: parsed.summary ?? message,
      }
    } catch {
      return null
    }
  }

  // 1) Groq Llama 3.1 8B — 極快、極省，分類任務足夠
  if (process.env.GROQ_API_KEY) {
    try {
      const groq = createGroq({ apiKey: process.env.GROQ_API_KEY })
      const { text } = await generateText({
        model: groq('llama-3.1-8b-instant'),
        messages: [{ role: 'user', content: prompt }],
        abortSignal: AbortSignal.timeout(10000),
      })
      const result = parse(text)
      if (result) return result
    } catch { /* try next */ }
  }

  // 2) 免費通道備援：CLIProxy → FreeLLM
  for (const entry of freeChain('gemini-3-flash')) {
    const text = await tryOpenAiCompat(entry, undefined, [{ role: 'user', content: prompt }])
    if (text) {
      const result = parse(text)
      if (result) return result
    }
  }

  // 3) 直連 Gemini 保底
  const model = directGemini()
  if (model) {
    try {
      const { text } = await generateText({ model, messages: [{ role: 'user', content: prompt }] })
      const result = parse(text)
      if (result) return result
    } catch { /* fall through */ }
  }

  return fallbackResult
}

// ── L2：常規回覆生成（Groq Qwen3 32B 為主力）───────────────────────────────
export async function generateCsReplyL2(
  system: string,
  messages: ChatMsg[],
): Promise<{ reply: string; provider: string } | null> {
  // 1) Groq Qwen3 32B — 繁中品質穩定、成本極低
  if (process.env.GROQ_API_KEY) {
    try {
      const groq = createGroq({ apiKey: process.env.GROQ_API_KEY })
      const { text } = await generateText({
        model: groq('qwen/qwen3-32b'),
        system,
        messages,
        maxOutputTokens: 2048,
        abortSignal: AbortSignal.timeout(20000),
      })
      if (text) return { reply: text, provider: 'Groq-Qwen3-32B' }
    } catch { /* try next */ }
  }

  // 2) 免費通道備援：CLIProxy → FreeLLM
  for (const entry of freeChain('gemini-3-flash')) {
    const text = await tryOpenAiCompat(entry, system, messages)
    if (text) return { reply: text, provider: entry.label }
  }

  // 3) 直連 Gemini 保底（gemini-3.1-flash-lite，非 gemini-2.5-flash）
  const model = directGemini()
  if (model) {
    try {
      const { text } = await generateText({ model, system, messages })
      if (text) return { reply: text, provider: 'Gemini-3.1-Flash-Lite' }
    } catch { /* fall through */ }
  }

  return null
}

// ── L3：進階處理（客人傳照片 / 複雜問題，僅 CORE 以上）─────────────────────
// 用 gemini-3-flash 本尊（非 lite）：多模態辨識與複雜推理品質優先於成本。
// Groq 的文字模型不支援看圖，L3 一律不經過 Groq。
export async function generateCsReplyL3(
  system: string,
  messages: ChatMsg[],
): Promise<{ reply: string; provider: string } | null> {
  // 1) 免費通道：CLIProxy → FreeLLM（皆走 gemini-3-flash）
  for (const entry of freeChain('gemini-3-flash')) {
    const text = await tryOpenAiCompat(entry, system, messages)
    if (text) return { reply: text, provider: entry.label }
  }

  // 2) 直連 gemini-3-flash 保底
  const geminiKey = process.env.GOOGLE_AI_API_KEY
  if (geminiKey) {
    try {
      const model = createGoogleGenerativeAI({ apiKey: geminiKey })('gemini-3-flash')
      const { text } = await generateText({ model, system, messages })
      if (text) return { reply: text, provider: 'Gemini-3-Flash' }
    } catch { /* fall through */ }
  }

  return null
}

// 免費層收到客人照片時的降級回覆：不呼叫任何 AI（省成本），請客人改文字描述。
export const IMAGE_DOWNGRADE_REPLY = '收到您傳的照片了，目前這個方案暫時無法直接辨識圖片內容，麻煩您用文字簡單描述一下狀況，我馬上為您處理，謝謝！'

// ── 免費層老闆升級提示：站內橫幅（寫入 cs_upgrade_nudges）+ Telegram 雙管道 ──
export type UpgradeNudgeReason = 'image' | 'complaint'

export async function notifyOwnerUpgradeNudge(
  ownerId: string,
  reason: UpgradeNudgeReason,
  customerMessage: string,
): Promise<void> {
  try {
    const { createAdminClient } = await import('@/lib/supabase/admin')
    const admin = createAdminClient()

    // 站內橫幅：寫入一筆紀錄，CS 工作台會顯示最近的提示
    void admin.from('cs_upgrade_nudges').insert({
      user_id: ownerId,
      reason,
      customer_message: customerMessage.slice(0, 200),
    })

    // Telegram：讀取老闆在「帳號設定」綁定的 Bot（與行銷審核通知共用同一組設定）
    const { data: profile } = await admin
      .from('profiles')
      .select('telegram_bot_token, telegram_chat_id')
      .eq('id', ownerId)
      .maybeSingle()
    const token = profile?.telegram_bot_token?.trim()
    const chatId = profile?.telegram_chat_id?.trim()
    if (!token || !chatId) return

    const reasonText = reason === 'image'
      ? '客人傳送了照片，但目前方案未開放 AI 圖片辨識'
      : '客人提出客訴/抱怨，目前方案未開放 AI 客訴進階處理'
    const text = `🔔 AI GATE 升級提示\n${reasonText}\n客人訊息：${customerMessage.slice(0, 80)}\n升級 CORE 即可讓 AI 直接處理，詳情請至 CS 工作台查看。`

    void fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text }),
    })
  } catch { /* 不中斷主流程 */ }
}
