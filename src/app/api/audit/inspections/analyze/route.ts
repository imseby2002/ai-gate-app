import { getUnitContextAny } from '@/lib/auth/unit-access'
import { NextRequest, NextResponse } from 'next/server'
import { createAnthropic } from '@ai-sdk/anthropic'
import { generateText } from 'ai'

export const maxDuration = 60

async function ctx() {
  const c = await getUnitContextAny(['audit', 'store', 'rd'])
  return c.ok ? c : null
}

const CATEGORY_PROMPTS: Record<string, string> = {
  hygiene: `【模組：門市環境＋衛生＋擺設＋隨手習慣】
請重點分析：
1. 水吧與工作台面整潔度、是否有積水或油垢。
2. 抹布分區使用（生熟/吧台/桌椅抹布是否定位合規）。
3. 器具與設備擺放之人體工學與動線流暢性（是否易碰撞、拿取是否順手）。
4. 人員隨手清潔習慣（Clean as you go）執行狀況。
5. OCR 解析手寫評論筆記，並整合進綜合分析。`,

  attitude: `【模組：門市服務態度＋微笑】
請重點分析：
1. 員工儀容與制服配件（圍裙、帽子/網帽、口罩合規性）。
2. 面部表情與微笑親和力、站姿儀態。
3. 迎賓與與顧客互動專注度。
4. OCR 解析稽核員之現場手寫評論，產出具體輔導建議。`,

  food_quality: `【模組：門市食品品質客觀指標】
請重點檢驗：
1. 賞味期限時間標籤（貼標日期、煮茶時間、保存期限是否清晰且在期限內）。
2. 茶湯色澤、冰塊純淨度、配料（珍珠/芋圓）外觀。
3. 依據上傳之測溫（℃）與糖度計（Brix°）數值，判斷是否落於標準配方公差內（±0.5度），若超標須立即警示重煮。`,

  safety_scrap: `【模組：門市原料安全管控・防假作廢真使用】
請重點檢驗：
1. 門市系統標註為「作廢/報廢」的原料批號，現場是否「依然被私自保存或置於吧台使用中」？
2. 若發現已申報作廢但現場仍在使用的重大違規，必須判定【一級食安舞弊・重罰申報】！
3. 原料密封與儲存溫度是否符合安全規範。`,

  shortage: `【模組：門市原料缺補料管控】
請重點檢驗：
1. 安全水位警報是否已超過 12 小時未送出叫貨單。
2. 幽靈原料/私購警示：POS 銷售該飲品但總部原料早已缺料，是否存在門市私下私購未經授權原料的情事。`,

  marketing_zalo: `【模組：門市行銷活動＋ZALO 私群＋公務機稽核】
請重點檢驗：
1. 現場立牌、菜單、點餐區的 Zalo / 轉帳 QR Code 是否為公司官方白名單？
2. 嚴厲防杜店員私設個人 Zalo 群、私下收款未入 POS 機。
3. 門市專屬公務機機況與登入帳號抽查。`,
}

// 多模態巡檢分析：照片＋手寫筆記 OCR ＋ 專家建議
export async function POST(req: NextRequest) {
  const c = await ctx()
  if (!c) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  if (!process.env.ANTHROPIC_API_KEY) return NextResponse.json({ error: 'ANTHROPIC_API_KEY 未設定' }, { status: 400 })

  const b = await req.json().catch(() => ({}))
  const category = String(b.category ?? 'hygiene')
  const photoUrl = String(b.photo_url ?? '').trim()
  const handwrittenNotes = String(b.handwritten_notes ?? '').trim()
  const extraContext = String(b.context ?? '').trim()

  const catPrompt = CATEGORY_PROMPTS[category] ?? CATEGORY_PROMPTS.hygiene

  const system = `你是連鎖餐飲總部的【資深首席稽核長】。
你正在協助現場巡檢人員分析一張稽核照片與現場手寫筆記。
${catPrompt}

請輸出格式化 JSON（以 markdown 代碼塊 json 包含）：
{
  "ocr_text": "辨識出的手寫筆記內容（若無手寫則填無）",
  "findings": ["觀察到的現場問題點1", "問題點2"],
  "analysis": "整體專業評語（結合人體工學、動線、衛生或公務機規範）",
  "suggested_score": 8.5, // 0~10 分
  "penalty_flag": false, // 是否觸發扣款重罰（如假作廢真使用、私設個人收款碼為 true）
  "penalty_reason": "若有重大違規的罰則條款說明，無則填空字串",
  "recommendations": ["具體改善行動1", "行動2"]
}`

  const userContent: any[] = []
  let textPrompt = `請分析此筆巡檢項目。\n類別：${category}\n稽核手寫/評論筆記：${handwrittenNotes || '（無另外附上手寫，請直接分析照片）'}`
  if (extraContext) textPrompt += `\n額外數據背景：${extraContext}`

  userContent.push({ type: 'text', text: textPrompt })
  if (photoUrl && photoUrl.startsWith('data:image')) {
    userContent.push({ type: 'image', image: photoUrl })
  }

  try {
    const anthropic = createAnthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
    const res = await generateText({
      model: anthropic('claude-sonnet-4-5'),
      system,
      maxOutputTokens: 2000,
      messages: [{ role: 'user', content: userContent }],
    })

    const raw = res.text
    let parsed: any = null
    const jsonMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/)
    if (jsonMatch) {
      try { parsed = JSON.parse(jsonMatch[1].trim()) } catch {}
    }
    if (!parsed) {
      try { parsed = JSON.parse(raw.trim()) } catch {}
    }

    if (!parsed) {
      parsed = {
        ocr_text: '',
        findings: [raw.slice(0, 100)],
        analysis: raw,
        suggested_score: 8,
        penalty_flag: false,
        penalty_reason: '',
        recommendations: [],
      }
    }

    return NextResponse.json({ ok: true, result: parsed })
  } catch (err: any) {
    return NextResponse.json({ error: `AI 分析失敗：${err.message}` }, { status: 500 })
  }
}
