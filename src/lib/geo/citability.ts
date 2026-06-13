/**
 * 段落可引用度評分（GEO）— 參考「最佳被引段落：自成段落、事實密集、直接回答、長度適中」。
 * 純運算、不呼叫 AI；逐段打分並標出最可能被引用 / 該改寫的段落。
 * 語言感知：CJK 以字數、拉丁語系以詞數計長度最佳區間。
 */
export interface PassageScore {
  index: number
  heading: string | null
  excerpt: string
  score: number               // 0–100
  length: number              // 計量單位（字/詞）
  factRich: boolean
  selfContained: boolean
  directAnswer: boolean
  reasons: string[]           // 改善建議
}

export interface CitabilityReport {
  score: number               // 文章整體 0–100（段落加權平均）
  passages: PassageScore[]
  best: number | null         // 最佳段落 index
  weakest: number | null      // 最該改寫段落 index
}

const CJK = /[一-鿿぀-ヿ]/
const QUESTION_HINT = /[?？]|如何|怎麼|怎样|為什麼|为什么|什麼|什么|多少|哪|嗎|吗|^(how|what|why|where|which|when|who|is|are|can|do|does)\b/i
const PRONOUN_START = /^(這|那|它|他們|它們|因此|所以|而且|此外|這些|那些|this|that|it|they|these|those|however|therefore|thus|also|and|but|so)\b[，,、\s]/i
const FACT_TOKEN = /(\d|％|%|＄|\$|NT\$|US\$|元|塊|分鐘|小時|公里|km|分|年|月|日|％|‰)/

interface Block { heading: string | null; text: string }

function splitBlocks(md: string): Block[] {
  const lines = md.replace(/\r\n/g, '\n').split('\n')
  const blocks: Block[] = []
  let heading: string | null = null
  let buf: string[] = []
  const flush = () => {
    const text = buf.join(' ').trim()
    if (text) blocks.push({ heading, text })
    buf = []
  }
  for (const line of lines) {
    const h = line.match(/^(#{1,3})\s+(.*)$/)
    if (h) { flush(); heading = h[2].trim(); continue }
    if (/^\s*$/.test(line)) { flush(); continue }
    // 表格列、清單、段落都當可引用內容；去掉 markdown 記號
    buf.push(line.replace(/^[\s>*-]+|\|/g, ' ').replace(/[#*`]/g, '').trim())
  }
  flush()
  return blocks
}

function measure(text: string): { len: number; cjk: boolean } {
  const cjkCount = (text.match(/[一-鿿぀-ヿ]/g) ?? []).length
  const latinWords = (text.match(/[A-Za-z0-9]+/g) ?? []).length
  const cjk = cjkCount > latinWords
  return { len: cjk ? cjkCount : latinWords, cjk }
}

/** 三角形評分：在 [lo, hi] 區間滿分，往兩側遞減 */
function bandScore(len: number, lo: number, hi: number, floor: number, ceil: number): number {
  if (len >= lo && len <= hi) return 1
  if (len < lo) return Math.max(0, (len - floor) / (lo - floor))
  return Math.max(0, (ceil - len) / (ceil - hi))
}

export function scoreCitability(md: string): CitabilityReport {
  const blocks = splitBlocks(md).filter(b => b.text.length > 0)
  const passages: PassageScore[] = blocks.map((b, i) => {
    const { len, cjk } = measure(b.text)
    // 長度最佳區間：拉丁 120–180 詞；CJK 150–350 字（自成的完整回答）
    const lenScore = cjk ? bandScore(len, 150, 350, 40, 600) : bandScore(len, 120, 180, 40, 320)

    const factRich = FACT_TOKEN.test(b.text)
    const selfContained = !PRONOUN_START.test(b.text)
    const directAnswer = !!b.heading && QUESTION_HINT.test(b.heading)

    const score = Math.round(
      lenScore * 40 +
      (factRich ? 25 : 0) +
      (selfContained ? 15 : 0) +
      (directAnswer ? 20 : 0),
    )

    const reasons: string[] = []
    if (lenScore < 0.6) reasons.push(cjk
      ? (len < 150 ? '段落偏短，擴充到約 150–350 字自成完整回答' : '段落偏長，拆成多段各自回答一個重點')
      : (len < 120 ? 'Too short — expand to ~120–180 words' : 'Too long — split into focused passages'))
    if (!factRich) reasons.push('缺具體數據/報價/單位，加入真實數字提升可引用度')
    if (!selfContained) reasons.push('開頭依賴前文（代名詞/連接詞），改成可獨立成立的陳述')
    if (!directAnswer) reasons.push('放到一個「問句式」H2/H3 小標下，並在首句直接回答')

    return {
      index: i,
      heading: b.heading,
      excerpt: b.text.slice(0, 80),
      score,
      length: len,
      factRich,
      selfContained,
      directAnswer,
      reasons,
    }
  })

  const overall = passages.length
    ? Math.round(passages.reduce((s, p) => s + p.score, 0) / passages.length)
    : 0

  let best: number | null = null, weakest: number | null = null
  passages.forEach(p => {
    if (best === null || p.score > passages[best].score) best = p.index
    if (weakest === null || p.score < passages[weakest].score) weakest = p.index
  })

  return { score: overall, passages, best, weakest }
}
