import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { generateText } from 'ai'
import { createAnthropic } from '@ai-sdk/anthropic'
import { CUSTOM_HEADING_FONTS, sanitizeCustomDesign } from '@/lib/booking/templates'

const FONT_LIST = CUSTOM_HEADING_FONTS
  .map((f, i) => `  ${i}: ${f.label}`)
  .join('\n')

const SYSTEM = `你是專業民宿官網設計師兼文案撰寫師。你可以同時設計官網視覺風格，也可以撰寫或優化所有頁面的文案內容。

【設計模式：二選一】

模式 A · 套用預設模板 —— 設定 template_id 為以下 4 種之一：
  * "natural"  — 自然山居（清新綠色系，overlay-left Hero，圓角按鈕，適合山林民宿）
  * "coastal"  — 海濱度假（天空藍系，centered Hero，適合海邊民宿）
  * "boutique" — 精品時尚（深灰/黑系，極簡 centered Hero，無圓角，適合精品旅館）
  * "zen"      — 日式禪意（石頭棕系，minimal Hero 底部文字，適合風格民宿）
  同時可用 theme_color（HEX）微調主色。

模式 B · 自由生成專屬設計 —— 當使用者要求「不要用模板」「自己設計」「獨一無二」時使用。
  設定 "template_id":"custom"，並附上 "custom_design" 物件，欄位如下（全部為必填，缺一律視為無效）：
  {
    "headingFontIndex": 0~2 之一（見下方字體白名單，只能用這 3 種，其他裝飾字體對中文內容沒有效果）：
${FONT_LIST}
    "headingWeight": "400"|"500"|"600"|"700"|"800"|"900"，
    "headingLetterSpacing": "normal"|"wide"|"wider"（大標題字距，精品/極簡調性可用 wider + headingUppercase）,
    "headingUppercase": true|false,
    "accent": "#RRGGBB"（主色，用於按鈕/連結/重點）,
    "ink": "#RRGGBB"（標題與內文墨色，不要用純黑 #000000，選一個跟主色協調的深色）,
    "muted": "#RRGGBB"（次要文字色，比 ink 淺、但仍需在白底上清楚可讀）,
    "sectionBg": "#RRGGBB"（區塊底色，通常是極淺的中性或帶色調背景，不要跟卡片背景一樣）,
    "cardBg": "#RRGGBB"（卡片背景，多半是白或接近白）,
    "cardBorder": "#RRGGBB"（卡片邊框，淺色、跟 sectionBg/cardBg 協調）,
    "cardRadius": "none"|"sm"|"md"|"lg"|"full"（卡片圓角程度）,
    "btnRadius": "none"|"sm"|"md"|"lg"|"full"（按鈕圓角程度）,
    "shadow": "none"|"soft"|"medium"（陰影強度，精品極簡風格常用 none）,
    "heroLayout": "overlay-left"|"centered"|"minimal"（首頁 Hero 版型）,
    "sectionPaddingScale": "compact"|"comfortable"|"spacious"（區塊留白節奏，質感越高留白通常越大）
  }

  設計原則（決定色彩與留白時務必遵守）：
  - 先決定一個核心情緒／材質意象（例如：木質溫暖、海島清爽、都會極簡、山林靜謐），再從那個意象推導所有顏色，不要隨機挑色
  - accent 與 ink 之間要有明顯對比但不能刺眼；muted 只需比 ink 淺，仍要在 cardBg 上可讀
  - sectionBg 與 cardBg 要有輕微層次（不能兩者用同一色），營造區塊分隔感而不是靠邊框硬分
  - 精品／極簡調性：cardRadius/btnRadius 選 none 或 sm、shadow 選 none、sectionPaddingScale 選 spacious、headingUppercase 可搭配 wider 字距
  - 自然／溫暖調性：cardRadius/btnRadius 選 lg 或 full、shadow 選 soft、headingUppercase 為 false
  - 不要為了「特別」而犧牲可讀性，文字對比永遠優先於美觀

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
1. 先用繁體中文自然回應，說明你做了什麼設計決策和原因（自由生成模式要說明選了什麼意象、為什麼這樣配色）
2. 若有要更新的欄位，在回覆末尾加：
<updates>
{"template_id":"coastal","theme_color":"#0369a1","tagline":"...",...（只含要更新的欄位；自由生成模式則含 "template_id":"custom" 與完整 "custom_design" 物件）}
</updates>
3. 僅回答問題或討論時，不需要 <updates> 區塊
4. 設計和文案要整體一致——模板/自訂設計、顏色、語氣要搭配
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
目前模板：${profile.template_id || 'natural'}${profile.template_id === 'custom' && profile.custom_design ? `（自由生成設計，目前 custom_design：${JSON.stringify(profile.custom_design)}）` : ''}
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

  // 自由生成模式的 custom_design 一定要通過驗證才能套用，避免壞掉的色碼/字體索引存進資料庫。
  // 這裡只驗證，資料庫存的仍是 AI 原始輸出（語意化的 scale 值），resolveDesign() 在畫面端會
  // 用同一個 sanitizeCustomDesign() 再轉成實際 CSS 值一次——兩邊要吃同一種輸入格式。
  if (updates && updates.template_id === 'custom' && !sanitizeCustomDesign(updates.custom_design)) {
    delete updates.template_id
    delete updates.custom_design
  }

  return NextResponse.json({ text, updates })
}
