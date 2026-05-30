import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { generateText } from 'ai'
import { createAnthropic } from '@ai-sdk/anthropic'

const SYSTEM = `你是專業民宿官網文案撰寫師。根據使用者需求，幫助優化或生成民宿官網各頁面文案。

可更新的欄位：
- tagline: 首頁 Hero 副標語（一句有感染力的話）
- about: 民宿故事（關於頁主文，2-4段）
- owner_intro: 主人介紹（溫暖有個性）
- hero_cta_text: 首頁主按鈕文字（短、有行動力）
- booking_instructions: 訂房頁說明（流程、注意事項）
- cancellation_policy: 取消政策
- contact_note: 聯絡頁說明（哪個管道最快等）
- seo_title: Google 搜尋標題（含民宿名稱，30字內）
- seo_description: 搜尋摘要（吸引人點擊，120字內）
- faq: 常見問題陣列 [{"q":"...","a":"..."}]

回覆規則：
1. 先用繁體中文自然回應使用者
2. 若有要更新的欄位，在回覆末尾加：
<updates>
{"tagline":"...", ...（只包含要更新的欄位）}
</updates>
3. 僅回答問題不更新時，不需要 <updates> 區塊
4. 文案用繁體中文，語氣溫暖有質感`

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { messages, profile } = await req.json()

  const anthropic = createAnthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

  const systemWithProfile = `${SYSTEM}

目前民宿資料（供參考）：
名稱：${profile.name || '（未填）'}
${profile.tagline ? `副標語：${profile.tagline}` : ''}
${profile.about ? `故事：${profile.about.slice(0, 200)}...` : ''}
模板：${profile.template_id || 'natural'}`

  const { text: raw } = await generateText({
    model: anthropic('claude-sonnet-4-6'),
    system: systemWithProfile,
    messages: messages.map((m: { role: string; content: string }) => ({
      role: m.role === 'user' ? 'user' : 'assistant',
      content: m.content,
    })),
    maxTokens: 2000,
  })

  const updatesMatch = raw.match(/<updates>([\s\S]*?)<\/updates>/)
  let updates: Record<string, unknown> | null = null
  let text = raw

  if (updatesMatch) {
    try {
      updates = JSON.parse(updatesMatch[1].trim())
      text = raw.replace(/<updates>[\s\S]*?<\/updates>/, '').trim()
    } catch { /* ignore parse error */ }
  }

  return NextResponse.json({ text, updates })
}
