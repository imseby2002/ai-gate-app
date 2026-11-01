// AI 依公司知識出題：指定各題型數量，產出中英越三語題目、答案、評分重點與說明。
// 專案沒有安裝 Anthropic 官方 SDK（且不得新增套件），沿用既有的 @ai-sdk/anthropic。
import { createAnthropic } from '@ai-sdk/anthropic'
import { generateText } from 'ai'
import { normalizeQuestion, type ExamQuestion, type QuestionType } from './types'

export const EXAM_MODEL = 'claude-opus-5-5'
/** 一次出題的知識總長上限（字元）；超過時請使用者減少選用的知識檔案，不靜默截斷 */
export const MAX_KNOWLEDGE_CHARS = 600_000
export const MAX_QUESTIONS_PER_RUN = 40

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

async function runModel(system: string, user: string, startPosition: number): Promise<ExamQuestion[]> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY 未設定')
  const res = await generateText({
    model: createAnthropic({ apiKey })(EXAM_MODEL),
    system,
    messages: [{ role: 'user', content: user }],
    maxOutputTokens: 64000,
  })
  const text = res.text.trim()
  const start = text.indexOf('[')
  const end = text.lastIndexOf(']')
  if (start < 0 || end <= start) throw new Error('AI 回傳格式錯誤，請再試一次')
  let arr: unknown
  try {
    arr = JSON.parse(text.slice(start, end + 1))
  } catch {
    throw new Error('AI 回傳格式錯誤，請再試一次')
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

export async function generateExamQuestions(opts: {
  knowledge: { title: string; content: string }[]
  counts: TypeCounts
  topic?: string
  startPosition: number
}): Promise<ExamQuestion[]> {

  const wanted = Object.entries(opts.counts).filter(([, n]) => (n ?? 0) > 0) as [QuestionType, number][]
  const total = wanted.reduce((s, [, n]) => s + n, 0)
  if (!total) return []

  const knowledgeText = opts.knowledge.map((k, i) => `<document index="${i + 1}" title="${k.title.replace(/"/g, "'")}">\n${k.content}\n</document>`).join('\n\n')

  const system = `你是企業內訓的出題老師。只能根據提供的公司知識文件出題，不可加入文件以外的事實；每題都要能在文件中找到依據。
題目要測驗理解與實務應用，避免只考字面記憶；選項的錯誤答案要合理、具迷惑性。
每題的題目、選項、答案說明都要同時提供繁體中文（zh）、英文（en）、越南文（vi），三種語言內容一致；越南文欄位不可夾雜中文。
explanation 說明為什麼正確答案是對的，並指出出自哪份文件。

${JSON_FORMAT}

題型規則：
${wanted.map(([t]) => '- ' + TYPE_GUIDE[t]).join('\n')}`

  const user = `${knowledgeText}

請依上面的文件出題，數量：${wanted.map(([t, n]) => `${t} ${n} 題`).join('、')}，共 ${total} 題。${opts.topic ? `\n出題重點：${opts.topic}` : ''}`

  return runModel(system, user, opts.startPosition)
}
