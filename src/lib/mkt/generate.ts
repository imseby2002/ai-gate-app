// 行銷一鍵整套產出：依品牌守則，為選定平台產生文案＋影片腳本＋圖片提示＋GEO 文章。
import { createAnthropic } from '@ai-sdk/anthropic'
import { generateText } from 'ai'
import { createAdminClient } from '@/lib/supabase/admin'
import { getSkillKnowledge } from '@/lib/skills/knowledge'

type Admin = ReturnType<typeof createAdminClient>
export const MKT_MODEL = 'claude-sonnet-4-5'

const CHANNEL_LABEL: Record<string, string> = {
  fb: 'Facebook 貼文', ig: 'Instagram 貼文', tiktok: 'TikTok 短影音', zalo: 'Zalo 貼文', line: 'LINE 官方帳號訊息',
}

function brandBlock(brand: Record<string, unknown> | null): string {
  if (!brand) return '（尚未設定品牌檔，請以一般專業飲料品牌口吻產出）'
  const c = (brand.colors ?? {}) as Record<string, string>
  const lines = [
    brand.name && `品牌：${brand.name}`,
    brand.slogan && `Slogan：${brand.slogan}`,
    brand.tagline && `定位：${brand.tagline}`,
    brand.tone && `語氣：${brand.tone}`,
    brand.audience && `目標客群：${brand.audience}`,
    brand.selling_points && `賣點：${brand.selling_points}`,
    brand.brand_story && `品牌故事：${brand.brand_story}`,
    (c.primary || c.secondary) && `標準色：${[c.primary, c.secondary, c.accent].filter(Boolean).join('、')}`,
    brand.banned_words && `禁用詞（絕對不可出現）：${brand.banned_words}`,
  ].filter(Boolean)
  return lines.join('\n')
}

// 產出整套內容。回傳 { outputs, model }
export async function generateContentSet(
  admin: Admin, ownerId: string, topic: string, brief: string, channels: string[],
): Promise<{ outputs: Record<string, unknown>; model: string }> {
  if (!process.env.ANTHROPIC_API_KEY) throw new Error('ANTHROPIC_API_KEY 未設定')
  const { data: brand } = await admin.from('mkt_brand').select('*').eq('owner_id', ownerId).maybeSingle()

  const chList = channels.filter(c => CHANNEL_LABEL[c])
  const chDesc = chList.map(c => `- "${c}"：${CHANNEL_LABEL[c]}`).join('\n')

  const system = `你是頂尖的連鎖飲料品牌行銷內容總監，擅長為各社群平台量身打造高轉換、貼近在地（越南／東南亞市場）的內容。
嚴格遵守以下品牌守則，語氣與賣點必須一致；禁用詞絕對不可出現：
${brandBlock(brand as Record<string, unknown> | null)}

要求：
- 每個平台依其特性調整（FB 稍長可說故事；IG 精簡＋主題標籤；TikTok 給口語腳本與分鏡；Zalo／LINE 親切促購）。
- 文案要具體、有記憶點、含明確行動呼籲（CTA），不要空泛。
- hashtags 給 5–10 個、貼近該市場。
- 只能輸出 JSON，不要任何解釋或 markdown 圍欄。

${getSkillKnowledge('viral-video-copywriting')}
（撰寫 video_script 短影片腳本時，務必套用上述短影音爆款方法論：黃金前 3 秒 Hook、完播與互動設計、POV 或敘事框架、不像廣告的 CTA，並具體到可直接拍攝。）`

  const shape = `{
${chList.map(c => `  "${c}": { "copy": "貼文文案", "hashtags": ["..."] }`).join(',\n')}${chList.length ? ',' : ''}
  "video_script": "15–30 秒短影片腳本，含分鏡與旁白",
  "image_prompt": "給 AI 生圖的英文提示詞，描述主視覺",
  "geo_article": { "title": "適合被搜尋引擎與 AI 引用的文章標題", "body": "600–800 字文章，自然帶入品牌與賣點" }
}`

  const user = `主題／新品：${topic}
${brief ? `補充說明：${brief}\n` : ''}要產出的平台：\n${chDesc || '（未選平台，仍請產出影片腳本、圖片提示與 GEO 文章）'}

請嚴格依下列 JSON 結構輸出（只回 JSON）：
${shape}`

  const anthropic = createAnthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  const res = await generateText({ model: anthropic(MKT_MODEL), system, maxOutputTokens: 4000, messages: [{ role: 'user', content: user }] })

  const outputs = parseJson(res.text)
  return { outputs, model: MKT_MODEL }
}

function parseJson(text: string): Record<string, unknown> {
  let t = text.trim()
  // 去除可能的 ```json 圍欄
  t = t.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim()
  const start = t.indexOf('{'); const end = t.lastIndexOf('}')
  if (start >= 0 && end > start) t = t.slice(start, end + 1)
  try { return JSON.parse(t) } catch { return { _raw: text } }
}
