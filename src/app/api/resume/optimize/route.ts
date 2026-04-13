import { NextRequest } from 'next/server'
import { createGroq } from '@ai-sdk/groq'
import { createOpenAI } from '@ai-sdk/openai'
import { createAnthropic } from '@ai-sdk/anthropic'
import { generateText, streamText } from 'ai'

export const runtime = 'nodejs'
export const maxDuration = 120

// ── SSE helper ──────────────────────────────────────────────────
function sse(controller: ReadableStreamDefaultController, payload: object) {
  const encoder = new TextEncoder()
  controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`))
}

// ── Phase 1: DeepSeek-R1 analysis (Groq → official fallback) ───
async function analyzeWithDeepSeekR1(jd: string, experience: string): Promise<string> {
  const prompt = `你是一位專業的職涯顧問與 ATS 優化專家。請仔細分析以下資料：

【目標職缺 JD】
${jd}

【求職者過往經歷】
${experience}

請完成以下分析（使用繁體中文）：

1. **JD 核心要求提取**
   - 必備技能（硬技能）
   - 加分技能
   - 職位核心職責
   - ATS 高頻關鍵字（列出 10 個以上）

2. **求職者優勢比對**
   - 哪些經歷與 JD 高度吻合（附說明）
   - 可量化的成就亮點

3. **落差分析**
   - 求職者目前缺少哪些 JD 要求
   - 可如何包裝現有經歷來彌補

4. **優化策略建議**
   - 建議重點強調的 3 個核心賣點
   - 自我介紹的定位方向
   - 技能區應補充的關鍵字

請給出詳細且具體的分析，這份分析將作為後續履歷撰寫的依據。`

  // Try Groq first
  try {
    const groq = createGroq({ apiKey: process.env.GROQ_API_KEY! })
    const { text } = await generateText({
      model: groq('deepseek-r1-distill-llama-70b'),
      prompt,
      maxOutputTokens: 2000,
    })
    return text
  } catch (groqErr) {
    console.warn('[resume] Groq DeepSeek-R1 failed, falling back to official DeepSeek:', groqErr)
  }

  // Fallback: official DeepSeek
  const deepseek = createOpenAI({
    apiKey: process.env.DEEPSEEK_API_KEY!,
    baseURL: 'https://api.deepseek.com/v1',
  })
  const { text } = await generateText({
    model: deepseek.chat('deepseek-reasoner'),
    prompt,
    maxOutputTokens: 2000,
  })
  return text
}

// ── Phase 2: Claude Sonnet writes the optimized resume ──────────
async function streamResumeWithClaude(
  jd: string,
  experience: string,
  analysis: string,
  imageBase64?: string,
) {
  const anthropic = createAnthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

  const systemPrompt = `你是一位頂尖的履歷撰寫專家，專精於台灣職場的履歷優化與 ATS 系統。
你的文字簡練有力、重點突出，擅長將普通的工作經歷轉化為吸引眼球的成就敘述。
請使用繁體中文（專有名詞可保留英文）撰寫，格式清晰易讀。`

  const userContent: Array<{ type: string; text?: string; image?: { url: string } }> = [
    {
      type: 'text',
      text: `請根據以下分析報告，為這位求職者撰寫一份完整的優化履歷。

━━━━━━ DeepSeek-R1 分析報告 ━━━━━━
${analysis}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

【目標職缺 JD】
${jd}

【原始經歷】
${experience}

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
- 整體篇幅控制在 A4 一頁半以內`,
    },
  ]

  // If image uploaded, include it for vision analysis
  if (imageBase64) {
    userContent.push({
      type: 'image',
      image: { url: `data:image/jpeg;base64,${imageBase64}` },
    } as { type: string; image: { url: string } })
    ;(userContent[0] as { type: string; text: string }).text +=
      '\n\n（附件：求職者上傳的現有履歷圖片，請參考其格式與內容一併優化）'
  }

  return streamText({
    model: anthropic('claude-sonnet-4-5'),
    system: systemPrompt,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    messages: [{ role: 'user' as const, content: userContent as any }],
    maxOutputTokens: 3000,
  })
}

// ── Main handler ────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  let jd = ''
  let experience = ''
  let imageBase64: string | undefined

  // Parse FormData (supports file upload) or JSON
  const contentType = req.headers.get('content-type') ?? ''
  if (contentType.includes('multipart/form-data')) {
    const form = await req.formData()
    jd = (form.get('jd') as string) ?? ''
    experience = (form.get('experience') as string) ?? ''
    const file = form.get('resume') as File | null
    if (file && file.type.startsWith('image/')) {
      const buf = await file.arrayBuffer()
      imageBase64 = Buffer.from(buf).toString('base64')
    }
    // PDF/Word: text extraction not yet implemented — skip for now
  } else {
    const body = await req.json()
    jd = body.jd ?? ''
    experience = body.experience ?? ''
  }

  if (!jd.trim() && !experience.trim()) {
    return new Response(JSON.stringify({ error: '請提供職缺 JD 或過往經歷' }), { status: 400 })
  }

  const stream = new ReadableStream({
    async start(controller) {
      try {
        // ── Phase 1: Analysis ────────────────────────────────
        sse(controller, {
          type: 'phase',
          phase: 'analyzing',
          label: 'DeepSeek-R1 正在分析 JD 與經歷落差...',
        })

        const analysis = await analyzeWithDeepSeekR1(jd, experience)

        sse(controller, {
          type: 'phase',
          phase: 'writing',
          label: 'Claude Sonnet 正在生成優化履歷...',
        })

        // ── Phase 2: Writing ─────────────────────────────────
        const claudeStream = await streamResumeWithClaude(jd, experience, analysis, imageBase64)

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
        console.error('[resume/optimize] error:', err)
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
