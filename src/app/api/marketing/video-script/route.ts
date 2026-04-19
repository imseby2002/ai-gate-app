/**
 * POST /api/marketing/video-script
 * 影片腳本單元 — Claude Sonnet 生成分鏡影片腳本
 *
 * Body: {
 *   count: number                   // 要產出的影片數量 (1-5)
 *   duration: '15' | '30' | '60' | '90' | '120'
 *   videoTypes: string[]            // 影片類型
 *   platforms: string[]             // 目標平台
 *   userInstructions?: string
 *   companyData?: object
 *   analysisData?: object
 *   copyData?: object
 *   imageScripts?: object           // 來自單元5
 *   collectedSummary?: string
 *   feedback?: string
 * }
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getCronOrUserAuth } from '@/lib/cron-auth'
import { createAnthropic } from '@ai-sdk/anthropic'
import { generateText } from 'ai'

export const runtime = 'edge'


export async function POST(req: NextRequest) {
  const authUser = await getCronOrUserAuth(req)
  if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const supabase = await createClient()

  const body = await req.json()
  const {
    count = 1,
    duration = '30',
    videoTypes = ['short_video'],
    platforms = ['instagram_reels', 'tiktok'],
    userInstructions = '',
    companyData,
    analysisData,
    copyData,
    imageScripts,
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
    ? Object.values(analysisData.results as Record<string, string>).join('\n\n').slice(0, 1500)
    : ''

  const copyCtx = copyData?.results
    ? Object.entries(copyData.results as Record<string, string>)
        .slice(0, 2)
        .map(([k, v]) => `[${k}]\n${String(v).slice(0, 200)}`)
        .join('\n\n')
    : ''

  const imageCtx = imageScripts?.scripts
    ? (imageScripts.scripts as { id: number; content: string }[])
        .slice(0, 2)
        .map(s => `[圖片腳本 ${s.id}]\n${s.content.slice(0, 300)}`)
        .join('\n\n')
    : ''

  const marketCtx = collectedSummary
    ? `\n市場調查摘要：\n${String(collectedSummary).slice(0, 1000)}`
    : ''

  const platformNames: Record<string, string> = {
    instagram_reels: 'Instagram Reels',
    facebook_reels:  'Facebook Reels',
    youtube_shorts:  'YouTube Shorts',
    tiktok:          'TikTok',
    youtube:         'YouTube',
  }

  const videoTypeNames: Record<string, string> = {
    short_video:  '短影音（直接吸睛）',
    ad:           '廣告影片（AIDA 結構）',
    tutorial:     '教學/示範影片',
    testimonial:  '客戶見證影片',
    brand_story:  '品牌故事影片',
  }

  const platformList = (platforms as string[]).map(p => platformNames[p] ?? p).join('、')
  const typeList = (videoTypes as string[]).map(t => videoTypeNames[t] ?? t).join('、')

  const feedbackSection = feedback ? `\n\n⚠️ 修改意見：${feedback}\n請根據以上意見調整腳本。` : ''
  const userRules = userInstructions ? `\n\n📌 使用者特別規定：\n${userInstructions}` : ''

  const anthropic = createAnthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

  const { text } = await generateText({
    model: anthropic('claude-sonnet-4-5'),
    system: `你是一位頂尖的影片行銷導演，擅長為各社群平台撰寫高轉換率的影片分鏡腳本。
你熟知短影音的黃金法則：前3秒必須抓住觀眾、節奏明快、視覺衝擊強、CTA清晰。
輸出格式：每個影片腳本用「===【影片 N】===」作為分隔標題，直接輸出腳本，不需其他說明。`,
    messages: [
      {
        role: 'user',
        content: `請根據以下品牌資料，產出 ${count} 個完整影片分鏡腳本：

【品牌資料】
${companyCtx}
${marketCtx}

【市場分析】
${analysisCtx || '（未提供）'}

【參考文案】
${copyCtx || '（未提供）'}

【參考圖片腳本】
${imageCtx || '（未提供）'}
${userRules}
${feedbackSection}

【影片規格】
- 數量：${count} 個影片
- 時長：${duration} 秒
- 類型：${typeList}
- 目標平台：${platformList}

【每個腳本請包含以下結構】

1. 影片標題：簡短有力（10字以內）
2. 影片類型與目的：這支影片要達成什麼行銷目標
3. 目標觀眾：誰會看這支影片
4. 開頭 Hook（0-3秒）：如何在前3秒抓住觀眾注意力
   - 畫面：視覺描述
   - 旁白/字幕：
   - 動作/轉場：

5. 分鏡腳本：（依時間點逐鏡描述）
   格式：[時間點] 畫面描述 | 旁白/字幕 | 字體特效/轉場建議

6. 結尾 CTA（最後3-5秒）：行動呼籲畫面與文字

7. 背景音樂：建議音樂風格與節奏感
8. 字幕建議：重點字幕的呈現方式
9. 拍攝建議：燈光、鏡頭、道具等實務建議
10. 後製重點：剪輯節奏、特效、貼圖建議

請確保每個腳本節奏明快、符合平台演算法偏好，且視覺與文字都具有強烈的轉換力。`,
      },
    ],
    maxOutputTokens: 4000,
  })

  // Parse sections
  const scripts: { id: number; content: string }[] = []
  for (let i = 1; i <= count; i++) {
    const regex = new RegExp(`===【影片 ${i}】===[\\s\\S]*?(?====【|$)`, 'g')
    const match = text.match(regex)
    scripts.push({
      id: i,
      content: match ? match[0].replace(`===【影片 ${i}】===`, '').trim() : (i === 1 ? text : ''),
    })
  }

  return NextResponse.json({ scripts, count, duration, platforms, videoTypes, fullText: text })
}
