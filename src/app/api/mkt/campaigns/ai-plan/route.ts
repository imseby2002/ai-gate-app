import { getUnitContextAny } from '@/lib/auth/unit-access'
import { NextRequest, NextResponse } from 'next/server'
import { generateText } from 'ai'
import { createAnthropic } from '@ai-sdk/anthropic'
import { createGoogleGenerativeAI } from '@ai-sdk/google'
import { createOpenAI } from '@ai-sdk/openai'
import { createGroq } from '@ai-sdk/groq'

export const maxDuration = 60

async function ctx() {
  return await getUnitContextAny(['mkt', 'marketing'])
}

function brandBlock(brand: Record<string, unknown> | null): string {
  if (!brand) return '（尚未設定品牌檔，請以時尚活力且注重品質的飲品連鎖品牌口吻產出）'
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
    brand.banned_words && `禁用詞：${brand.banned_words}`,
  ].filter(Boolean)
  return lines.join('\n')
}

export async function POST(req: NextRequest) {
  const c = await ctx()
  if (!c.ok) return NextResponse.json({ error: c.status === 401 ? 'Unauthorized' : 'Forbidden' }, { status: c.status })

  const b = await req.json().catch(() => ({}))
  const topic = String(b.topic ?? '').trim()
  if (!topic) return NextResponse.json({ error: '活動主題必填' }, { status: 400 })

  const channel_type = String(b.channel_type ?? 'offline')
  const category = String(b.category ?? 'event')
  const brief = String(b.brief ?? '').trim()
  const store = String(b.store ?? '').trim()
  const budget = Number(b.budget) || 0

  const { data: brand } = await c.admin.from('mkt_brand').select('*').eq('owner_id', c.ownerId).maybeSingle()
  const { data: products } = await c.admin.from('mkt_product_profiles').select('name, price, slogan, category').eq('owner_id', c.ownerId).limit(20)

  const productListStr = (products && products.length > 0)
    ? products.map(p => `- ${p.name} (${p.category || '飲品'})：售價 ${p.price}，賣點: ${p.slogan || '熱銷推薦'}`).join('\n')
    : '（尚無自訂商品，請預設為招牌特調茶飲、奶茶與果茶系列）'

  const prompt = `你是餐飲連鎖品牌的資深行銷總監與活動策劃大師。
請根據以下需求，規劃一份高度具體、可立即落地的行銷活動企劃方案。

【活動需求】
- 活動主題/發想：${topic}
- 活動通路：${channel_type === 'offline' ? '實體活動 (門市/戶外/快閃)' : channel_type === 'online' ? '線上活動 (社群/外送/會員)' : '虛實整合 (OMO 混合活動)'}
- 活動類型：${category}
- 門市範圍：${store || '全門市 / 全品牌'}
- 規劃預算：${budget > 0 ? budget.toLocaleString() : '適中控管'}
- 額外補充需求/優惠想法：${brief || '無特定限制，請自由發揮高轉換機制'}

【品牌背景守則】
${brandBlock(brand as Record<string, unknown> | null)}

【主力商品參考】
${productListStr}

【輸出格式要求】
請嚴格輸出純 JSON 物件（不得包含 markdown 標籤或額外文字），欄位結構如下：
{
  "theme": "具體且有號召力的策劃名稱",
  "slogan": "一句洗腦且吸引人的主打口號",
  "target_audience": "本次活動主要鎖定之目標受眾輪廓",
  "mechanics": "核心促銷/互動機制說明（例如：第2杯半價、打卡送小禮、加價購優惠券等）",
  "social_copy": "適用於 FB/IG/LINE 的宣傳貼文範本，含吸引人的開頭、優惠說明、活動時間與 CTA 行動呼籲",
  "hashtags": ["活動標籤1", "活動標籤2", "熱門標籤3"],
  "staff_script": "門市現場吧檯店員向顧客推薦此活動的 15 秒親切話術",
  "display_guideline": "現場物料展架/布條/海報或線上外送 Banner 的設計建議",
  "checklist": [
    "前置準備：活動前物料印製與原料庫存備貨",
    "前置準備：門市夥伴話術教育訓練與 POS 促銷按鍵設定",
    "活動期間：社群每日發布、現場打卡區引導",
    "活動結束：POS 數據結算、原料耗損盤點與成效覆盤"
  ],
  "kpi_target": "預估目標（例如：帶動門市總銷量成長 15%~25%、客單價提升 10%）"
}`

  let proposal: any = null

  // 依序嘗試可用之模型
  if (process.env.ANTHROPIC_API_KEY) {
    try {
      const anthropic = createAnthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
      const res = await generateText({
        model: anthropic('claude-3-5-sonnet-latest'),
        prompt,
      })
      proposal = JSON.parse(res.text.replace(/```json/g, '').replace(/```/g, '').trim())
    } catch (e) {
      console.warn('Anthropic generation fallback:', e)
    }
  }

  if (!proposal && process.env.GEMINI_API_KEY) {
    try {
      const google = createGoogleGenerativeAI({ apiKey: process.env.GEMINI_API_KEY })
      const res = await generateText({
        model: google('gemini-2.0-flash'),
        prompt,
      })
      proposal = JSON.parse(res.text.replace(/```json/g, '').replace(/```/g, '').trim())
    } catch (e) {
      console.warn('Gemini generation fallback:', e)
    }
  }

  if (!proposal && process.env.GROQ_API_KEY) {
    try {
      const groq = createGroq({ apiKey: process.env.GROQ_API_KEY })
      const res = await generateText({
        model: groq('llama-3.3-70b-versatile'),
        prompt,
      })
      proposal = JSON.parse(res.text.replace(/```json/g, '').replace(/```/g, '').trim())
    } catch (e) {
      console.warn('Groq generation fallback:', e)
    }
  }

  // 若外部模型未配置，提供結構化高品質 fallback
  if (!proposal) {
    proposal = {
      theme: topic,
      slogan: `暢飲好時光，${topic} 驚喜開跑！`,
      target_audience: '注重生活品味的年輕上班族、學生與喜愛嚐鮮的茶飲愛好者',
      mechanics: '指定主打飲品享同品項第二杯半價，加贈 VIP 會員限定新品折價券一張。現場拍照打卡上傳再贈限量品牌精緻提袋。',
      social_copy: `🔥【${topic}・限時驚喜來襲】🔥\n給忙碌的自己一杯滿滿元氣！凡至門市或線上點單，即享超值回饋。\n快標記好友一起來喝一杯！👉 門市現正熱映中！`,
      hashtags: [`#${topic.replace(/\s+/g, '')}`, '#手搖飲', '#限時優惠', '#手作茶飲', '#新品上市'],
      staff_script: '您好！今天我們門市有舉辦專屬活動，指定招牌飲品第二杯半價，要不要幫您帶兩杯跟同事或朋友分享呢？',
      display_guideline: '吧檯櫃台擺放 A4 活動立牌，店門口懸掛主視覺 X 展架，色彩採用品牌明亮標準色突出折扣字樣。',
      checklist: [
        '活動前 3 天：確認物料到店與促銷 POP 擺設位置',
        '活動前 1 天：確認原物料包材存量加倍備料',
        '活動首日：門市夥伴晨會宣達促銷話術與核銷方式',
        '活動每日：彙整日結單與熱銷品項銷售佔比',
        '活動結束：結算銷售杯數、營收成長率並產出覆盤報告'
      ],
      kpi_target: '預估活動期間帶動來客數成長 20%、主力飲品銷售佔比提升至 35%'
    }
  }

  return NextResponse.json({ ok: true, proposal })
}
