// CS AI 回覆的共用路由邏輯，供 cs-chat（測試分頁）與 cs-webhook（正式頻道）共用，
// 避免兩處各自維護造成行為走鐘。
//
// L1 分流：Groq Llama 3.1 8B 快速判斷意圖/風險（取代已排定下線的 gemini-2.5-flash）
// L2 常規：Groq Qwen3 32B 為主力生成繁中回覆，免費通道／直連依序備援
// 每一步都走「免費資源優先，付費墊底」：Groq 免費層 → CLIProxy → FreeLLM → 直連 Gemini
import { generateText, type ModelMessage } from 'ai'
import { createGroq } from '@ai-sdk/groq'
import { createGoogleGenerativeAI } from '@ai-sdk/google'
import { normalizeFreeLlmBaseUrl } from '@/lib/ai/providers/free-llm'

export type ChatMsg = ModelMessage

interface FreeChainEntry {
  url: string
  key: string
  model: string
  label: string
}

// 免費通道優先序：CLIProxy → FreeLLM（依使用者指定順序）
// FreeLLM 收錄的模型從 8B 小模型到 GPT-4o/Mistral Large 等旗艦模型都有，
// 用 'auto' 完全不可控——可能在 L2/L3/L4 這種品質敏感的層級隨機選到能力很弱的模型。
// 因此 FreeLLM 這條也要依呼叫層級指定模型，不能像 CLIProxy 那樣共用同一個 model 參數。
// freeLlmModel 字串是依 FreeLLM 後台顯示名稱推測，實際 API 要傳的 id 可能不同，
// 故用對應的環境變數保留覆寫空間，避免猜錯字串導致這條免費入口永遠打不中。
function freeChain(cliProxyModel: string, freeLlmModel: string): FreeChainEntry[] {
  const cliProxyUrl = process.env.CLI_PROXY_API_URL ?? process.env.NEXT_PUBLIC_CLI_PROXY_API_URL
  const freeLlmUrlRaw = process.env.FREE_LLM_URL ?? process.env.NEXT_PUBLIC_FREE_LLM_URL
  return [
    ...(cliProxyUrl
      ? [{ url: cliProxyUrl, key: process.env.CLI_PROXY_API_KEY ?? 'no-key', model: cliProxyModel, label: 'CLIProxy' }]
      : []),
    ...(process.env.FREE_LLM_API_KEY && freeLlmUrlRaw
      ? [{ url: normalizeFreeLlmBaseUrl(freeLlmUrlRaw), key: process.env.FREE_LLM_API_KEY, model: freeLlmModel, label: 'FreeLLM' }]
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
  /** 需要即時網路資訊（天氣、附近景點、當下狀態等知識庫不會有的問題）僅 PRO+ 觸發搜尋分支 */
  needsSearch: boolean
}

export async function classifyIntentL1(
  message: string,
  intentCategories: string[],
  knowledgeSection: string,
): Promise<ClassifyResult> {
  const prompt = `你是一個客服意圖分類器。請分析以下客戶訊息，回傳 JSON（只回傳 JSON，不要有其他文字）：

意圖類別（從中選一）：${intentCategories.join('、')}
風險等級：low（一般諮詢）/ medium（需要人工協助）/ high（投訴、退款、法律）
needsSearch：客戶問題是否需要「即時網路資訊」才能回答（例如天氣、附近景點/店家、當下交通狀況等知識庫不會有的即時資料）→ true；一般諮詢、房型/價格/訂單等知識庫內資訊 → false${knowledgeSection}

客戶訊息：「${message}」

回傳格式：{"intent":"...","risk":"low|medium|high","summary":"一句話摘要客戶需求","needsSearch":true|false}`

  const fallbackResult: ClassifyResult = { intent: '其他', risk: 'low', summary: message, needsSearch: false }

  const parse = (text: string): ClassifyResult | null => {
    try {
      const parsed = JSON.parse(text.replace(/```json\n?|```/g, '').trim())
      if (!parsed.intent) return null
      return {
        intent: parsed.intent,
        risk: (['low', 'medium', 'high'].includes(parsed.risk) ? parsed.risk : 'low') as ClassifyResult['risk'],
        summary: parsed.summary ?? message,
        needsSearch: parsed.needsSearch === true,
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
  // FreeLLM 這條指定小模型（Llama 3.1 8B Instant 同等級）：分類任務用不到大模型，
  // 避免 'auto' 在這種高頻小任務上浪費掉配額大的旗艦模型。
  const l1FreeLlmModel = process.env.FREE_LLM_L1_MODEL ?? 'llama-3.1-8b-instant'
  for (const entry of freeChain('gemini-3-flash', l1FreeLlmModel)) {
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

// ── L2：常規回覆生成（Groq Qwen3.6 27B 為主力）─────────────────────────────
// qwen/qwen3-32b 已於 2026/6/17 被 Groq 棄用，官方建議改用 qwen/qwen3.6-27b。
export async function generateCsReplyL2(
  system: string,
  messages: ChatMsg[],
): Promise<{ reply: string; provider: string } | null> {
  // 1) Groq Qwen3.6 27B — 繁中品質穩定、成本極低
  if (process.env.GROQ_API_KEY) {
    try {
      const groq = createGroq({ apiKey: process.env.GROQ_API_KEY })
      const { text } = await generateText({
        model: groq('qwen/qwen3.6-27b'),
        system,
        messages,
        maxOutputTokens: 2048,
        abortSignal: AbortSignal.timeout(20000),
      })
      if (text) return { reply: text, provider: 'Groq-Qwen3.6-27B' }
    } catch { /* try next */ }
  }

  // 2) 免費通道備援：CLIProxy → FreeLLM
  // FreeLLM 指定 GLM-4.5 Flash：中文語感通常比 Llama/Mistral 系穩定，額度也寬裕，
  // 適合當客服常規回覆的備援，避免 'auto' 選到清單裡能力偏弱的小模型。
  const l2FreeLlmModel = process.env.FREE_LLM_L2_MODEL ?? 'glm-4.5-flash'
  for (const entry of freeChain('gemini-3-flash', l2FreeLlmModel)) {
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
  // 1) 免費通道：CLIProxy 走 gemini-3-flash；FreeLLM 指定 GPT-4o——
  // L3 處理照片辨識，FreeLLM 清單裡多數是純文字模型，選到不支援看圖的模型會讓圖片被默默忽略，
  // GPT-4o 是清單裡明確具備視覺能力的少數選項之一。
  const l3FreeLlmModel = process.env.FREE_LLM_L3_MODEL ?? 'gpt-4o'
  for (const entry of freeChain('gemini-3-flash', l3FreeLlmModel)) {
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

// ── 搜尋分支：客人問題需要即時網路資訊時使用（僅 PRO 以上，由 L1 的 needsSearch 觸發）──
// 免費資源優先：FreeLLM 的 Compound Mini（額度遠高於 Groq 官方免費層的 250 次/日）
// → CLIProxy 的 gemini-3-flash-agent（代理模式，內建 Google Search grounding）
// → Perplexity Sonar 付費保底（purpose-built 搜尋，非全租戶都會設定 PERPLEXITY_API_KEY）
export async function generateCsReplySearch(
  system: string,
  messages: ChatMsg[],
): Promise<{ reply: string; provider: string } | null> {
  // 1) FreeLLM：Compound Mini (Groq)。實際 model id 依 FreeLLM 服務後台為準，
  // 可用 FREE_LLM_SEARCH_MODEL 覆寫，避免猜錯字串導致這個免費入口永遠打不中。
  const freeLlmUrlRaw = process.env.FREE_LLM_URL ?? process.env.NEXT_PUBLIC_FREE_LLM_URL
  if (process.env.FREE_LLM_API_KEY && freeLlmUrlRaw) {
    const searchModel = process.env.FREE_LLM_SEARCH_MODEL ?? 'compound-mini'
    const text = await tryOpenAiCompat(
      { url: normalizeFreeLlmBaseUrl(freeLlmUrlRaw), key: process.env.FREE_LLM_API_KEY, model: searchModel, label: 'FreeLLM-CompoundMini' },
      system, messages,
    )
    if (text) return { reply: text, provider: 'FreeLLM-CompoundMini' }
  }

  // 2) CLIProxy：gemini-3-flash-agent
  const cliProxyUrl = process.env.CLI_PROXY_API_URL ?? process.env.NEXT_PUBLIC_CLI_PROXY_API_URL
  if (cliProxyUrl) {
    const text = await tryOpenAiCompat(
      { url: cliProxyUrl, key: process.env.CLI_PROXY_API_KEY ?? 'no-key', model: 'gemini-3-flash-agent', label: 'CLIProxy-Agent' },
      system, messages,
    )
    if (text) return { reply: text, provider: 'CLIProxy-Agent' }
  }

  // 3) Perplexity Sonar 保底（付費，只有設定 PERPLEXITY_API_KEY 才會用到）
  const perplexityKey = process.env.PERPLEXITY_API_KEY
  if (perplexityKey) {
    try {
      const { createOpenAI } = await import('@ai-sdk/openai')
      const perplexity = createOpenAI({ apiKey: perplexityKey, baseURL: 'https://api.perplexity.ai' })
      const { text } = await generateText({
        model: perplexity.chat('sonar'),
        system,
        messages,
        abortSignal: AbortSignal.timeout(20000),
      })
      if (text) return { reply: text, provider: 'Perplexity-Sonar' }
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
