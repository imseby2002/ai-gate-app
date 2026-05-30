import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { generateText } from 'ai'
import { createAnthropic } from '@ai-sdk/anthropic'

const SYSTEM = `你是專業民宿官網設計師兼文案撰寫師。你可以同時設計官網視覺風格，也可以撰寫或優化所有頁面的文案內容。

【可控制的設計欄位】
- template_id: 視覺模板，只能是以下 4 種之一：
  * "natural"  — 自然山居（清新綠色系，overlay-left Hero，圓角按鈕，適合山林民宿）
  * "coastal"  — 海濱度假（天空藍系，centered Hero，適合海邊民宿）
  * "boutique" — 精品時尚（深灰/黑系，極簡 centered Hero，無圓角，適合精品旅館）
  * "zen"      — 日式禪意（石頭棕系，minimal Hero 底部文字，適合風格民宿）
- theme_color: 主題色 HEX 值（如 "#2d6a4f"），影響按鈕、連結、重點色

【可控制的文案欄位】
- tagline: 首頁 Hero 副標語（一句有感染力的話）
- about: 民宿故事（關於頁主文，2-4 段，有情感深度）
- owner_intro: 主人介紹（溫暖有個性，拉近與旅客的距離）
- hero_cta_text: 首頁主按鈕文字（短、有行動力，預設「立即訂房」）
- booking_instructions: 訂房頁說明（流程與注意事項）
- cancellation_policy: 取消政策（清楚友善）
- contact_note: 聯絡頁說明（告知最快回覆管道）
- seo_title: Google 搜尋標題（含民宿名稱，30 字內）
- seo_description: 搜尋摘要（吸引人點擊，120 字內）
- faq: 常見問題陣列 [{"q":"問題","a":"答案"}]

【回覆規則】
1. 先用繁體中文自然回應，說明你做了什麼設計決策和原因
2. 若有要更新的欄位，在回覆末尾加：
<updates>
{"template_id":"coastal","theme_color":"#0369a1","tagline":"...",...（只含要更新的欄位）}
</updates>
3. 僅回答問題或討論時，不需要 <updates> 區塊
4. 設計和文案要整體一致——模板、顏色、語氣要搭配
5. 繁體中文，語氣溫暖有質感`

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { messages, profile } = await req.json()

  const anthropic = createAnthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

  const systemWithProfile = `${SYSTEM}

【目前官網狀態】
名稱：${profile.name || '（未填）'}
目前模板：${profile.template_id || 'natural'}
目前主題色：${profile.theme_color || '（未設定）'}
副標語：${profile.tagline || '（未填）'}
民宿故事：${profile.about ? profile.about.slice(0, 300) + '...' : '（未填）'}
SEO 標題：${profile.seo_title || '（未填）'}`

  const { text: raw } = await generateText({
    model: anthropic('claude-sonnet-4-6'),
    system: systemWithProfile,
    messages: messages.map((m: { role: string; content: string }) => ({
      role: m.role === 'user' ? 'user' : 'assistant',
      content: m.content,
    })),
    maxOutputTokens: 2500,
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
