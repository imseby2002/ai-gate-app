import { createClient } from '@/lib/supabase/server'
import { createAnthropic } from '@ai-sdk/anthropic'
import { generateText } from 'ai'

export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const year = parseInt(searchParams.get('year') || String(new Date().getFullYear()))

  const anthropic = createAnthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

  const { text } = await generateText({
    model: anthropic('claude-sonnet-4-6'),
    maxOutputTokens: 2048,
    prompt: `請列出台灣 ${year} 年與 ${year + 1} 年初的假期資訊：

1. 所有連續假期（含補班補課安排後，實際連放 3 天以上的連假，例如：春節、清明、端午、中秋、國慶、元旦等）
2. 高中以下學校寒假期間（通常 1 月下旬至 2 月中旬）
3. 高中以下學校暑假期間（通常 7 月初至 8 月底）

以 JSON array 格式回覆，每個物件包含：
{
  "name": "假期名稱（例：春節連假、端午連假、寒假、暑假）",
  "from": "YYYY-MM-DD",
  "to": "YYYY-MM-DD",
  "type": "holiday" 或 "winter_vacation" 或 "summer_vacation"
}

只回傳純 JSON array，不要 markdown \`\`\` 包裝，不要任何說明文字。`,
  })

  try {
    const cleaned = text.trim().replace(/^```json\n?/, '').replace(/\n?```$/, '')
    const holidays = JSON.parse(cleaned)
    if (!Array.isArray(holidays)) throw new Error('not array')
    return Response.json({ holidays, year })
  } catch {
    return Response.json({ holidays: [], year })
  }
}
