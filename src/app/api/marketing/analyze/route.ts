import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getCronOrUserAuth } from '@/lib/cron-auth'
import { createGoogleGenerativeAI } from '@ai-sdk/google'
import { generateText } from 'ai'

export const maxDuration = 60

type AnalysisType =
  | 'swot'
  | 'company'
  | 'competitor_activity'
  | 'competitor_performance'
  | 'content'
  | 'marketing'

const ANALYSIS_PROMPTS: Record<AnalysisType, string> = {
  swot: `**SWOT 分析**
請針對該公司進行完整的 SWOT 分析：
- 優勢（Strengths）：3-4 點，含具體說明
- 劣勢（Weaknesses）：3-4 點，含改善建議
- 機會（Opportunities）：3-4 點，含市場趨勢佐證
- 威脅（Threats）：3-4 點，含應對策略
最後給出整體競爭力評分（0-100）與一句策略總結。`,

  company: `**公司分析**
根據提供的公司資料與市場情報，分析：
1. 業態定位：在產業鏈中的位置、商業模式、主要收入來源
2. 規模評估：人員規模、資本額、市場份額推估
3. 營業情況：近期業績趨勢、成長率（依可得資料推估）
4. 核心能力：技術、品牌、通路、客戶關係優勢
5. 風險點：財務、市場、技術、法規面風險
6. 成長建議：3 個具體可行的成長策略`,

  competitor_activity: `**競爭對手活動分析**
根據蒐集的市場資料，分析主要競爭對手的行銷活動：
1. 競品清單：列出 3-5 個主要競爭對手（含品牌名稱）
2. 活動類型：各競品最近的促銷、活動、廣告手法
3. 渠道分佈：各競品主攻的行銷渠道（社群/搜尋/實體等）
4. 內容策略：各競品的文案風格、訴求方向、視覺語言
5. 活動頻率：發文、廣告、促銷的頻率與時機
6. 效果評估：預估各競品活動的效果與受眾反應
7. 可借鑒之處：值得我方參考的策略 3 點`,

  competitor_performance: `**競爭對手業績分析**
根據可得的市場情報，分析競爭對手的業績表現：
1. 市場份額：各主要競品的市場佔比推估
2. 成長趨勢：各競品近期業績成長或衰退跡象
3. 定價策略：各競品的定價區間與策略特點
4. 客戶口碑：評論平台的評分、口碑優劣分析
5. 業績驅動因素：是什麼讓領先競品表現優異
6. 我方機會窗口：競品的業績弱點或服務空白`,

  content: `**競品內容/影片擷取分析**
分析競爭對手的內容行銷與影片策略：
1. 內容主題：競品最常發布的內容主題與關鍵字
2. 影片策略：影片類型（短影音/教學/直播/廣告）、時長、風格
3. 標題技巧：競品吸引點擊的標題結構與用詞
4. 鉤子（Hook）：開頭 3 秒的吸引手法
5. 行動呼籲：競品如何引導受眾轉換
6. 高績效內容特徵：互動數高的內容有哪些共同特質
7. 內容差異化建議：我方如何在內容上做出差異`,

  marketing: `**行銷文案分析**
分析市場上的行銷文案趨勢與建議：
1. 文案風格趨勢：目前市場主流的文案風格與語氣
2. 關鍵訴求點：消費者最有感的訴求（痛點/渴望/恐懼/好奇）
3. 高轉換文案結構：AIDA/PAS/Story 等框架在此產業的應用
4. 關鍵字與標籤：高搜尋量與高互動的關鍵字清單
5. 平台差異：FB/IG/LINE/TikTok 各平台的文案差異點
6. 我方文案建議：
   - 主標題方向（3 個候選）
   - 副標題邏輯
   - 行動呼籲（CTA）建議`,
}

export async function POST(req: NextRequest) {
  try {
  const authUser = await getCronOrUserAuth(req)
  if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const supabase = await createClient()

  const body = await req.json()
  const {
    types = ['swot', 'marketing'],
    collectedData,
    companyData,
    extraContext,
    // legacy
    companyName: legacyName,
    companyInfo: legacyInfo,
    topic,
    industry,
  } = body

  const selectedTypes: AnalysisType[] = types

  // Build company context
  const company = companyData ?? {}
  const companyCtx = [
    `公司名稱：${company.companyName ?? legacyName ?? '未提供'}`,
    `產業：${company.industry ?? industry ?? '未提供'}`,
    `員工人數：${company.employees ?? '未提供'}`,
    `資本額：${company.capital ?? '未提供'}`,
    `成立年份：${company.founded ?? '未提供'}`,
    `網站：${company.website ?? '未提供'}`,
    `公司簡介：${company.description ?? legacyInfo ?? '未提供'}`,
    `主要產品/服務：${company.products ?? '未提供'}`,
    `目標客群：${company.targetAudience ?? '未提供'}`,
    `競爭優勢：${company.competitiveAdvantage ?? '未提供'}`,
    `品牌語調：${company.brandTone ?? '未提供'}`,
  ].join('\n')

  const marketCtx = collectedData
    ? `\n\n市場蒐集資料（摘要）：\n${String(collectedData).slice(0, 6000)}`
    : ''

  const extraCtx = extraContext
    ? `\n\n【補充參考資料】\n${String(extraContext).slice(0, 8000)}`
    : ''

  const google = createGoogleGenerativeAI({ apiKey: process.env.GOOGLE_AI_API_KEY! })

  // Run each analysis type independently in parallel for speed
  const results: Record<string, string> = {}

  const baseCtx = `【公司資料】\n${companyCtx}${topic ? `\n行銷主題：${topic}` : ''}${marketCtx}${extraCtx}`

  await Promise.all(
    selectedTypes.map(async (t) => {
      try {
        const { text } = await generateText({
          model: google('gemini-2.5-flash'),
          providerOptions: {
            google: { thinkingConfig: { thinkingBudget: 0 } },
          },
          messages: [
            {
              role: 'user',
              content: `你是資深行銷策略顧問，請用繁體中文、條列格式，精簡回答（每點1-2句）。

${baseCtx}

${ANALYSIS_PROMPTS[t]}

最後附上關鍵指標 JSON（放在 <metrics> 標籤內）：
<metrics>{"opportunity":80,"competitors":8,"audience":"20萬+","score":75}</metrics>`,
            },
          ],
          maxOutputTokens: 1500,
        })
        results[t] = text
      } catch (e) {
        results[t] = `分析失敗：${String(e)}`
      }
    })
  )

  // Extract metrics from last result
  const lastText = Object.values(results).pop() ?? ''
  const metricsMatch = lastText.match(/<metrics>([\s\S]*?)<\/metrics>/)
  let metrics = { opportunity: 80, competitors: 8, audience: '20萬+', score: 75 }
  if (metricsMatch) {
    try { metrics = { ...metrics, ...JSON.parse(metricsMatch[1].trim()) } } catch { /* default */ }
  }

  // Clean metrics tag from results
  const cleanResults: Record<string, string> = {}
  for (const [k, v] of Object.entries(results)) {
    cleanResults[k] = v.replace(/<metrics>[\s\S]*?<\/metrics>/, '').trim()
  }

  return NextResponse.json({ results: cleanResults, metrics, types: selectedTypes })
  } catch (err) {
    console.error('[analyze]', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
