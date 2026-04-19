import { NextRequest } from 'next/server'
import { createAnthropic } from '@ai-sdk/anthropic'
import { createClient } from '@/lib/supabase/server'
import { streamText } from 'ai'

export const runtime = 'edge'


function sse(controller: ReadableStreamDefaultController, payload: object) {
  const encoder = new TextEncoder()
  controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`))
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })

  let jd = '', experience = '', templateId = '', customInstructions = ''

  const contentType = req.headers.get('content-type') ?? ''
  if (contentType.includes('multipart/form-data')) {
    const form = await req.formData()
    jd = (form.get('jd') as string) ?? ''
    experience = (form.get('experience') as string) ?? ''
    templateId = (form.get('templateId') as string) ?? ''
    customInstructions = (form.get('customInstructions') as string) ?? ''
  } else {
    const body = await req.json()
    jd = body.jd ?? ''
    experience = body.experience ?? ''
    templateId = body.templateId ?? ''
    customInstructions = body.customInstructions ?? ''
  }

  if (!jd.trim() && !experience.trim()) {
    return new Response(JSON.stringify({ error: '請提供職缺 JD 或過往經歷' }), { status: 400 })
  }

  // Fetch template from DB if provided
  let templateContent = ''
  let templateName = ''
  if (templateId) {
    const { data: tpl } = await supabase
      .from('cover_letter_templates')
      .select('name, content')
      .eq('id', templateId)
      .single()
    if (tpl) {
      templateContent = tpl.content
      templateName = tpl.name
    }
  }

  const anthropic = createAnthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

  const systemPrompt = `你是一位頂尖的求職信（Cover Letter）撰寫專家，精通台灣與國際職場的求職信格式。
你的文字真誠有力、重點突出，能精準匹配 JD 關鍵字，讓求職信通過 ATS 篩選。
請使用繁體中文撰寫（專有名詞可保留英文），格式清晰易讀。`

  const userPrompt = `請根據以下資料，為這位求職者撰寫一封完整的求職信（Cover Letter）。

【目標職缺 JD】
${jd || '（未提供）'}

【求職者過往經歷】
${experience || '（未提供）'}

${templateContent ? `【使用模板：${templateName}】
請以下方模板結構為基礎，用實際內容取代所有 [佔位符]：

${templateContent}` : `【請自由發揮求職信結構】
包含：開場白 → 核心技能與成就 → 對公司的認識與動機 → 結語`}

${customInstructions ? `【額外要求】\n${customInstructions}` : ''}

請注意：
- 將所有 [佔位符] 替換成根據 JD 和經歷推斷的實際內容
- 量化成就（盡可能使用數字：%、規模、時間）
- ATS 關鍵字自然嵌入
- 語氣真誠，避免過於公式化`

  const stream = new ReadableStream({
    async start(controller) {
      try {
        sse(controller, { type: 'phase', label: 'Claude Sonnet 撰寫求職信中...' })

        const claudeStream = await streamText({
          model: anthropic('claude-sonnet-4-5'),
          system: systemPrompt,
          messages: [{ role: 'user', content: userPrompt }],
          maxOutputTokens: 2000,
        })

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
        console.error('[resume/cover-letter] error:', err)
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
