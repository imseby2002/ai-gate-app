// AI 依公司知識出題：指定各題型數量，產出中英越三語題目、答案、評分重點與說明。
// 模型走免費優先鏈（content）：CLIProxy gemini-2.5-pro / gpt-5.5 / kimi-k2.5 → FreeLLM → Claude Haiku 5.5 → Sonnet 5.5
import { chainText, looksLikeJson } from '@/lib/ai/proxy-fallback'
import { normalizeQuestion, type ExamQuestion, type QuestionType } from './types'

/** 一次出題的知識總長上限（字元）；超過時請使用者減少選用的知識檔案，不靜默截斷 */
export const MAX_KNOWLEDGE_CHARS = 600_000
export const MAX_QUESTIONS_PER_RUN = 40
/** 每次呼叫 AI 產出題目的單批上限：三語題目量大（約 300~400 tokens/題），分批產生避免超過模型輸出上限與 JSON 截斷 */
const MAX_BATCH_SIZE = 5

export type TypeCounts = Partial<Record<QuestionType, number>>

const TYPE_GUIDE: Record<QuestionType, string> = {
  single: 'single = 單選題：options 3~4 個，answer 為單一選項代號（如 "B"）',
  multi: 'multi = 多選題：options 4~5 個，answer 為 2 個以上正確選項代號陣列（如 ["A","C"]）',
  fill: 'fill = 填空題：題目中以「____」標示空格，answer 為 { zh: [...], en: [...], vi: [...] }，列出各語言可接受的答案寫法（同義詞、數字寫法）',
  short: 'short = 簡答題：answer 為參考答案 { zh, en, vi }（2~4 句），rubric 為評分重點 { zh, en, vi }（列出應涵蓋的要點），points 預設 5',
  essay: 'essay = 申論題：answer 為參考答案 { zh, en, vi }（一段完整論述），rubric 為評分標準 { zh, en, vi }（列出 3~5 個評分面向與配分），points 預設 10',
}

/** 人工出題內容上限（字元） */
export const MAX_MANUAL_CHARS = 20_000

const JSON_FORMAT = `只輸出一個 JSON 陣列，不要任何其他文字或 Markdown。每個元素格式：
{ "type": "single|multi|fill|short|essay", "question": { "zh": "", "en": "", "vi": "" }, "options": [ { "text": { "zh": "", "en": "", "vi": "" } } ], "answer": ..., "rubric": { "zh": "", "en": "", "vi": "" }, "explanation": { "zh": "", "en": "", "vi": "" }, "points": 1 }
沒有選項的題型 options 給 []；不需要 rubric 的題型 rubric 給空字串。`

/**
 * 依使用者指定的章節／範圍（如「前3章」、「Chương 1-3」、「前 30%」）截取知識文件內容
 */
export function applyScopeToKnowledge(
  knowledge: { title: string; content: string }[],
  scope?: string
): { title: string; content: string }[] {
  if (!scope || !scope.trim()) return knowledge
  const s = scope.trim().toLowerCase()

  // 1. 百分比模式（例如：前 30%、30%）
  const pctMatch = s.match(/(?:前|first)?\s*(\d{1,2})\s*%/i)
  if (pctMatch) {
    const pct = Math.max(5, Math.min(100, parseInt(pctMatch[1], 10))) / 100
    return knowledge.map(k => ({
      title: k.title,
      content: k.content.slice(0, Math.max(800, Math.floor(k.content.length * pct))),
    }))
  }

  // 2. 指定前 N 章、第 1~N 章（中英越支援：前 3 章、第 1-3 章、chương 1-3、first 3 chapters、3 chương đầu）
  const numMatch = s.match(/(?:前|first|đầu)\s*(\d+)|(?:第|chương|chapter)\s*1\s*(?:-|~|到|to|đến)\s*(\d+)|(\d+)\s*(?:章|chương|chapter|chương đầu)/i)
  const targetChapters = numMatch ? parseInt(numMatch[1] || numMatch[2] || numMatch[3], 10) : 0

  if (targetChapters > 0) {
    return knowledge.map(k => {
      const lines = k.content.split('\n')
      let count = 0
      let cutLineIndex = -1
      // 辨識常見章節開頭：#、第X章、Chapter X、Chương X、Part X、Phần X 等
      const headerRegex = /^(?:#{1,3}\s+|第\s*[0-9一二三四五六七八九十百]+\s*[章節卷部篇]|(?:chapter|chương|part|phần)\s*\d+)/i
      for (let i = 0; i < lines.length; i++) {
        if (headerRegex.test(lines[i].trim())) {
          count++
          if (count === targetChapters + 1) {
            cutLineIndex = i
            break
          }
        }
      }
      if (cutLineIndex > 0) {
        return {
          title: k.title,
          content: lines.slice(0, cutLineIndex).join('\n'),
        }
      }
      // 若未能精確抓到第 N+1 章標題，以章節數比例合理截取前段（每章抓約 15%~20% 內容）
      const fraction = Math.min(1, Math.max(0.2, targetChapters * 0.18))
      return {
        title: k.title,
        content: k.content.slice(0, Math.max(1000, Math.floor(k.content.length * fraction))),
      }
    })
  }

  return knowledge
}

async function runModel(system: string, user: string, startPosition: number): Promise<ExamQuestion[]> {
  const res = await chainText('content', {
    system,
    messages: [{ role: 'user', content: user }],
    maxOutputTokens: 64000,
  }, { feature: 'exams', validate: looksLikeJson, timeoutMs: 300000 })
  let text = res.text.trim()
  text = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim()
  const start = text.indexOf('[')
  const end = text.lastIndexOf(']')
  if (start < 0 || end <= start) throw new Error('AI 回傳格式錯誤，請再試一次')
  let arr: unknown
  try {
    arr = JSON.parse(text.slice(start, end + 1))
  } catch {
    try {
      // 容錯移除尾端多餘逗號
      const sanitized = text.slice(start, end + 1).replace(/,\s*([\]}])/g, '$1')
      arr = JSON.parse(sanitized)
    } catch {
      throw new Error('AI 回傳格式錯誤，請再試一次')
    }
  }
  if (!Array.isArray(arr)) throw new Error('AI 回傳格式錯誤，請再試一次')
  return arr
    .map((q, i) => normalizeQuestion(q, startPosition + i))
    .filter((q): q is ExamQuestion => !!q)
}

/**
 * 人工出題、AI 修飾：出題者自己寫題目（可能是草稿、單一語言、格式不一，不一定跟知識文件有關），
 * AI 逐題整理措辭、補齊選項／答案／評分重點／說明，並翻成中英越三語。不新增出題者沒寫的題目。
 */
export async function polishManualQuestions(opts: {
  manual: string
  knowledge: { title: string; content: string }[]
  startPosition: number
}): Promise<ExamQuestion[]> {
  const knowledgeText = opts.knowledge.length
    ? opts.knowledge.map((k, i) => `<document index="${i + 1}" title="${k.title.replace(/"/g, "'")}">\n${k.content}\n</document>`).join('\n\n') + '\n\n'
    : ''
  const system = `你是企業內訓的出題老師，負責把出題者手寫的題目整理成正式考題。
規則：
- 逐題處理出題者寫的每一題，保留原本的題意、考點與題型；不可自行新增或刪除題目。
- 出題者有指定題型（單選、多選、填空、簡答、申論）就照做；沒指定就判斷最合適的題型。
- 修飾文字：讓題目清楚、通順、專業，但不改變意思。
- 出題者已給的選項與答案要保留；缺少的部分（選項、正確答案、參考答案、評分重點、說明）依常識或提供的文件合理補齊。
- 題目不受公司知識文件限制；有提供文件時可用來補答案與說明。
- 每題的題目、選項、答案、說明都要同時提供繁體中文（zh）、英文（en）、越南文（vi），三種語言內容一致；越南文欄位不可夾雜中文。

${JSON_FORMAT}

題型規則：
${Object.values(TYPE_GUIDE).map(g => '- ' + g).join('\n')}`
  const user = `${knowledgeText}<manual_questions>\n${opts.manual}\n</manual_questions>\n\n請整理上面 manual_questions 裡出題者手寫的題目。`
  return runModel(system, user, opts.startPosition)
}

/** 單批出題內部函式 */
async function generateSingleBatch(opts: {
  knowledge: { title: string; content: string }[]
  counts: TypeCounts
  topic?: string
  scope?: string
  startPosition: number
}): Promise<ExamQuestion[]> {
  const wanted = Object.entries(opts.counts).filter(([, n]) => (n ?? 0) > 0) as [QuestionType, number][]
  const total = wanted.reduce((s, [, n]) => s + n, 0)
  if (!total) return []

  const slicedKnowledge = applyScopeToKnowledge(opts.knowledge, opts.scope)
  const knowledgeText = slicedKnowledge.map((k, i) => `<document index="${i + 1}" title="${k.title.replace(/"/g, "'")}">\n${k.content}\n</document>`).join('\n\n')

  const system = `你是企業內訓的出題老師。只能根據提供的公司知識文件出題，不可加入文件以外的事實；每題都要能在文件中找到依據。
題目要測驗理解與實務應用，避免只考字面記憶；選項的錯誤答案要合理、具迷惑性。
${opts.scope ? `【重要規則 — 指定出題範圍／章節限制】：本次出題已被嚴格限定於「${opts.scope}」範圍內，絕不可超出此範圍出題！未提及的章節或知識請勿作為考點。` : ''}
每題的題目、選項、答案說明都要同時提供繁體中文（zh）、英文（en）、越南文（vi），三種語言內容一致；越南文欄位不可夾雜中文。
explanation 說明為什麼正確答案是對的，並指出出自哪份文件。

${JSON_FORMAT}

題型規則：
${wanted.map(([t]) => '- ' + TYPE_GUIDE[t]).join('\n')}`

  const user = `${knowledgeText}

請依上面的文件出題，數量：${wanted.map(([t, n]) => `${t} ${n} 題`).join('、')}，共 ${total} 題。${opts.scope ? `\n出題範圍限制：${opts.scope}` : ''}${opts.topic ? `\n出題重點：${opts.topic}` : ''}`

  return runModel(system, user, opts.startPosition)
}

/**
 * AI 依公司知識出題：
 * 支援章節／範圍限定（scope），並自動分批（每批上限 5 題）並行或依序產生，徹底解決單次 40 題輸出超過 token 上限導致 JSON 截斷與失敗的問題。
 */
export async function generateExamQuestions(opts: {
  knowledge: { title: string; content: string }[]
  counts: TypeCounts
  topic?: string
  scope?: string
  startPosition: number
}): Promise<ExamQuestion[]> {
  const wanted = Object.entries(opts.counts).filter(([, n]) => (n ?? 0) > 0) as [QuestionType, number][]
  const total = wanted.reduce((s, [, n]) => s + n, 0)
  if (!total) return []

  // 若題數 <= MAX_BATCH_SIZE (5題)，直接單次產出
  if (total <= MAX_BATCH_SIZE) {
    return generateSingleBatch(opts)
  }

  // 將所有要求的題目拆分成若干批次，每批最多 MAX_BATCH_SIZE (5題)
  const items: QuestionType[] = []
  for (const [t, n] of wanted) {
    for (let i = 0; i < n; i++) items.push(t)
  }

  const batchCountsList: TypeCounts[] = []
  for (let i = 0; i < items.length; i += MAX_BATCH_SIZE) {
    const chunk = items.slice(i, i + MAX_BATCH_SIZE)
    const bCounts: TypeCounts = {}
    for (const t of chunk) {
      bCounts[t] = (bCounts[t] ?? 0) + 1
    }
    batchCountsList.push(bCounts)
  }

  // 最多同時並行 2 批，兼顧產出速度與模型連線穩定度
  const allResults: ExamQuestion[] = []
  const concurrency = 2

  for (let i = 0; i < batchCountsList.length; i += concurrency) {
    const currentBatches = batchCountsList.slice(i, i + concurrency)
    const batchPromises = currentBatches.map(async (bCounts, batchIdx) => {
      const currentStart = opts.startPosition + allResults.length + batchIdx * MAX_BATCH_SIZE
      // 單批若偶發失敗，自動重試一次
      try {
        return await generateSingleBatch({
          ...opts,
          counts: bCounts,
          startPosition: currentStart,
        })
      } catch (err) {
        console.warn(`[exam-generate-batch] batch ${i + batchIdx} failed, retrying once...`, err)
        return await generateSingleBatch({
          ...opts,
          counts: bCounts,
          startPosition: currentStart,
        })
      }
    })

    const batchResults = await Promise.all(batchPromises)
    for (const res of batchResults) {
      allResults.push(...res)
    }
  }

  // 統一重設 position 確保連貫
  return allResults.map((q, idx) => ({
    ...q,
    position: opts.startPosition + idx,
  }))
}

/**
 * AI 單題重新出題：
 * 針對特定題目重新產出一題替換，可給予自訂意見（如加深難度、變更考點、情境題），也可不給意見隨機重出。
 */
export async function regenerateSingleQuestion(opts: {
  knowledge: { title: string; content: string }[]
  questionType: QuestionType
  points?: number
  currentQuestion?: { zh?: string; en?: string; vi?: string }
  feedback?: string
  topic?: string
  scope?: string
  position: number
}): Promise<ExamQuestion> {
  const slicedKnowledge = applyScopeToKnowledge(opts.knowledge, opts.scope)
  const knowledgeText = slicedKnowledge.length
    ? slicedKnowledge.map((k, i) => `<document index="${i + 1}" title="${k.title.replace(/"/g, "'")}">\n${k.content}\n</document>`).join('\n\n')
    : ''

  const typeGuide = TYPE_GUIDE[opts.questionType] ?? TYPE_GUIDE.single
  const prevQ = opts.currentQuestion?.zh || opts.currentQuestion?.vi || opts.currentQuestion?.en

  const system = `你是企業內訓的出題老師。現在要重新出「1 題」考題替換原本不滿意的題目。
規則：
- 只能根據提供的公司知識文件出題，每題都要能在文件中找到依據。
- 題型必須為：${typeGuide}
${prevQ ? `- 原有不滿意的題目為：「${prevQ}」，請出一道全新的題目替代它，題目與選項不可與原題目重複。` : ''}
${opts.feedback ? `- 出題者給予的修改指示／要求：「${opts.feedback}」，請務必遵循此要求調整新題目！` : ''}
${opts.scope ? `- 【出題範圍限制】：本次只針對「${opts.scope}」範圍出題，絕不可超出此範圍。` : ''}
- 每題的題目、選項、答案說明都要同時提供繁體中文（zh）、英文（en）、越南文（vi），三種語言內容一致；越南文欄位不可夾雜中文。
- explanation 說明為什麼正確答案是對的，並指出出自哪份文件。

${JSON_FORMAT}
只輸出包含 1 個題目的 JSON 陣列：[ { ... } ]`

  const user = `${knowledgeText}

請重新出一道 ${opts.questionType} 題目替換。配分：${opts.points ?? (opts.questionType === 'essay' ? 10 : opts.questionType === 'short' ? 5 : 1)} 分。${opts.scope ? `\n指定範圍：${opts.scope}` : ''}${opts.topic ? `\n出題重點：${opts.topic}` : ''}${opts.feedback ? `\n修改指示：${opts.feedback}` : ''}`

  const questions = await runModel(system, user, opts.position)
  if (!questions.length) throw new Error('AI 未能產生替換題目，請再試一次')
  const q = questions[0]
  if (opts.points) q.points = opts.points
  q.type = opts.questionType
  return q
}
