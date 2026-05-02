import { NextRequest } from 'next/server'
import { createOpenAI } from '@ai-sdk/openai'
import { createAnthropic } from '@ai-sdk/anthropic'
import { generateText, streamText } from 'ai'

// ── SSE helper ───────────────────────────────────────────────────
function sse(controller: ReadableStreamDefaultController, payload: object) {
  const encoder = new TextEncoder()
  controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`))
}

// ── Analysis prompt ───────────────────────────────────────────────
function buildAnalysisPrompt(jd: string, experience: string) {
  return `你是一位專業的職涯顧問與 ATS 優化專家。請仔細分析以下資料：

【目標職缺 JD】
${jd || '（未提供）'}

【求職者過往經歷】
${experience || '（未提供）'}

請完成以下分析（使用繁體中文）：

1. **JD 核心要求提取**
   - 必備技能（硬技能）與加分技能
   - 職位核心職責
   - ATS 高頻關鍵字（列出 10 個以上）

2. **求職者優勢比對**
   - 哪些經歷與 JD 高度吻合（附說明）
   - 可量化的成就亮點

3. **落差分析**
   - 目前缺少哪些 JD 要求，以及如何包裝現有經歷彌補

4. **優化策略建議**
   - 3 個核心賣點、自我介紹定位方向、技能區應補充的關鍵字

請給出具體分析，此分析將作為後續履歷撰寫的依據。`
}

// ── Phase 1: 分析（官方 DeepSeek-R1）────────────────────────────
async function runAnalysis(jd: string, experience: string): Promise<{ text: string; usedModel: string }> {
  const prompt = buildAnalysisPrompt(jd, experience)

  const deepseek = createOpenAI({
    apiKey: process.env.DEEPSEEK_API_KEY!,
    baseURL: 'https://api.deepseek.com/v1',
  })
  const { text } = await generateText({
    model: deepseek.chat('deepseek-reasoner'),
    prompt,
    maxOutputTokens: 2000,
  })
  return { text, usedModel: '官方 DeepSeek-R1' }
}

// ── Phase 2: Claude Sonnet 撰寫履歷 ──────────────────────────────
async function streamResumeWithClaude(
  jd: string,
  experience: string,
  analysis: string,
  analysisModel: string,
  imageBase64?: string,
) {
  const anthropic = createAnthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

  const systemPrompt = `你是一位頂尖的履歷撰寫專家，專精於台灣職場的履歷優化與 ATS 系統。
你的文字簡練有力、重點突出，擅長將普通的工作經歷轉化為吸引眼球的成就敘述。
請使用繁體中文（專有名詞可保留英文）撰寫，格式清晰易讀。`

  const mainText = `請根據以下分析報告，為這位求職者撰寫一份完整的優化履歷。

━━━━━━ AI 分析報告（${analysisModel}）━━━━━━
${analysis}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

【目標職缺 JD】
${jd || '（未提供）'}

【原始經歷】
${experience || '（未提供）'}

━━━━━━ 請生成以下履歷結構 ━━━━━━

## 專業摘要
（3-4 句，高度匹配 JD，含核心關鍵字）

## 核心技能
（ATS 友善的技能清單，分組呈現）

## 工作經歷
（依時間倒序，每段職位含：職稱、公司、時間、2-4 條以 STAR 法則撰寫的成就，數字化結果）

## 學歷

## 其他（證照、語言能力等，如有相關）

---
請確保：
- 每條經歷都以強力動詞開頭（主導、推動、建立、優化、達成）
- 盡可能量化成果（百分比、數字、規模）
- 關鍵字自然嵌入，通過 ATS 掃描
- 整體篇幅控制在 A4 一頁半以內`

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const content: any[] = [{ type: 'text', text: mainText }]

  if (imageBase64) {
    content.push({ type: 'image', image: { url: `data:image/jpeg;base64,${imageBase64}` } })
    content[0].text += '\n\n（附件：求職者上傳的現有履歷圖片，請參考其格式與內容一併優化）'
  }

  return streamText({
    model: anthropic('claude-sonnet-4-5'),
    system: systemPrompt,
    messages: [{ role: 'user' as const, content }],
    maxOutputTokens: 3000,
  })
}

// ── Main handler ─────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  let jd = ''
  let experience = ''
  let imageBase64: string | undefined

  const contentType = req.headers.get('content-type') ?? ''
  if (contentType.includes('multipart/form-data')) {
    const form = await req.formData()
    jd = (form.get('jd') as string) ?? ''
    experience = (form.get('experience') as string) ?? ''
    const file = form.get('resume') as File | null
    if (file && file.type.startsWith('image/')) {
      const buf = await file.arrayBuffer()
      // Edge-compatible base64 encoding (no Buffer)
      const uint8 = new Uint8Array(buf)
      let binary = ''
      for (let i = 0; i < uint8.byteLength; i++) binary += String.fromCharCode(uint8[i])
      imageBase64 = btoa(binary)
    }
  } else {
    const body = await req.json()
    jd = body.jd ?? ''
    experience = body.experience ?? ''
  }

  if (!jd.trim() && !experience.trim()) {
    return new Response(JSON.stringify({ error: '請提供職缺 JD 或過往經歷' }), { status: 400 })
  }

  // ── 在 stream 外層先執行分析（確保 fallback 邏輯完整執行）──────
  let analysis = ''
  let analysisModel = ''
  try {
    const result = await runAnalysis(jd, experience)
    analysis = result.text
    analysisModel = result.usedModel
  } catch (err) {
    console.error('[resume/optimize] All analysis providers failed:', err)
    return new Response(
      JSON.stringify({ error: `AI 分析服務暫時無法使用，請稍後再試。(${String(err)})` }),
      { status: 503 },
    )
  }

  // ── 分析完成，開始串流履歷生成 ────────────────────────────────
  const stream = new ReadableStream({
    async start(controller) {
      try {
        sse(controller, { type: 'phase', phase: 'analyzing' }) // 馬上標記分析已完成
        sse(controller, {
          type: 'phase',
          phase: 'writing',
          label: `Claude Sonnet 正在生成優化履歷...（分析由 ${analysisModel} 完成）`,
        })

        const claudeStream = await streamResumeWithClaude(jd, experience, analysis, analysisModel, imageBase64)

        for await (const part of claudeStream.fullStream) {
          if (part.type === 'text-delta') {
            sse(controller, { type: 'delta', content: part.text })
          } else if (part.type === 'error') {
            throw part.error
          }
        }

        sse(controller, { type: 'done' })
        const encoder = new TextEncoder()
        controller.enqueue(encoder.encode('data: [DONE]\n\n'))
      } catch (err) {
        console.error('[resume/optimize] stream error:', err)
        sse(controller, { type: 'error', error: String(err) })
      } finally {
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  })
}
