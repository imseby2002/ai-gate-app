/**
 * POST /api/marketing/image-script
 * 圖片腳本單元 — Claude Sonnet 生成圖片視覺腳本
 *
 * Body: {
 *   count: number                   // 要產出的圖片數量 (1-10)
 *   platforms: string[]             // 目標平台
 *   userInstructions?: string       // 使用者自訂規定（選填）
 *   companyData?: object            // 來自單元2
 *   analysisData?: object           // 來自單元3
 *   copyData?: object               // 來自單元4
 *   collectedSummary?: string       // 來自單元1
 *   feedback?: string               // 修改意見（重新生成時）
 * }
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getCronOrUserAuth } from '@/lib/cron-auth'
import { createAnthropic } from '@ai-sdk/anthropic'
import { generateText } from 'ai'

export async function POST(req: NextRequest) {
  const authUser = await getCronOrUserAuth(req)
  if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const supabase = await createClient()

  const body = await req.json()
  const {
    count = 3,
    platforms = ['facebook_post', 'instagram_caption'],
    userInstructions = '',
    companyData,
    analysisData,
    copyData,
    collectedSummary,
    feedback,
  } = body

  const company = companyData ?? {}
  const companyCtx = `
公司名稱：${company.companyName ?? '品牌'}
產業：${company.industry ?? ''}
主要產品/服務：${company.products ?? ''}
目標客群：${company.targetAudience ?? ''}
品牌語調：${company.brandTone ?? ''}
競爭優勢：${company.competitiveAdvantage ?? ''}`.trim()

  const analysisCtx = analysisData?.results
    ? Object.values(analysisData.results as Record<string, string>).join('\n\n').slice(0, 2000)
    : ''

  const copyCtx = copyData?.results
    ? Object.entries(copyData.results as Record<string, string>)
        .slice(0, 3)
        .map(([k, v]) => `[${k}]\n${String(v).slice(0, 300)}`)
        .join('\n\n')
    : ''

  const marketCtx = collectedSummary
    ? `\n市場調查摘要：\n${String(collectedSummary).slice(0, 1500)}`
    : ''

  const platformNames: Record<string, string> = {
    facebook_post: 'Facebook',
    instagram_caption: 'Instagram',
    threads_post: 'Threads',
    line_message: 'LINE',
    twitter_post: 'Twitter/X',
    linkedin_post: 'LinkedIn',
    youtube_description: 'YouTube',
  }
  const platformList = (platforms as string[])
    .map((p: string) => platformNames[p] ?? p)
    .join('、')

  const feedbackSection = feedback
    ? `\n\n⚠️ 修改意見：${feedback}\n請根據以上意見調整腳本。`
    : ''

  const userRules = userInstructions
    ? `\n\n📌 使用者特別規定：\n${userInstructions}`
    : ''

  const anthropic = createAnthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

  const { text } = await generateText({
    model: anthropic('claude-sonnet-4-5'),
    system: `你是一位頂尖的視覺行銷設計顧問，擅長根據品牌特性與行銷文案，撰寫清晰可執行的圖片視覺腳本。
每張圖片的腳本應包含：視覺場景、色調風格、主要元素、文字疊加、情感訴求、設計建議，以及 AI 圖片生成的英文 Prompt。
輸出格式：每張圖片用「===【圖片 N】===」作為分隔標題，直接輸出腳本內容，不需其他說明。`,
    messages: [
      {
        role: 'user',
        content: `請根據以下品牌資料與行銷內容，為各平台產出 ${count} 張行銷圖片的視覺腳本：

【品牌資料】
${companyCtx}

【目標平台】
${platformList || '社群媒體平台'}
${marketCtx}

【市場分析摘要】
${analysisCtx || '（未提供）'}

【參考文案】
${copyCtx || '（未提供）'}
${userRules}
${feedbackSection}

【輸出要求】
請產出 ${count} 張圖片腳本，每張腳本包含：

1. 圖片主題：簡短標題（10字以內）
2. 行銷目的：這張圖片要達成的目標（引起注意/建立信任/促進行動等）
3. 視覺場景：描述畫面構圖、主要視覺元素、人物或物品配置
4. 色調風格：主色調、輔助色、整體風格（極簡/活潑/高端/溫馨等）
5. 文字疊加：建議放在圖片上的標題文字與副文案（繁體中文）
6. 情感訴求：圖片要傳達的核心情感或價值
7. 適用平台：最適合發布此圖的平台及比例建議（如 1:1 Instagram、4:5 Facebook）
8. AI 生成 Prompt：英文，30-60字，可直接用於 Midjourney/DALL-E/Stable Diffusion 生成此圖

請確保每張圖片腳本風格各異，涵蓋不同訴求角度（如：產品展示/生活情境/數據/人物故事/促銷活動等）。`,
      },
    ],
    maxOutputTokens: 4000,
  })

  // Parse sections
  const scripts: { id: number; content: string }[] = []
  for (let i = 1; i <= count; i++) {
    const regex = new RegExp(`===【圖片 ${i}】===[\\s\\S]*?(?====【|$)`, 'g')
    const match = text.match(regex)
    scripts.push({
      id: i,
      content: match
        ? match[0].replace(`===【圖片 ${i}】===`, '').trim()
        : (i === 1 ? text : ''),
    })
  }

  return NextResponse.json({ scripts, count, fullText: text })
}
