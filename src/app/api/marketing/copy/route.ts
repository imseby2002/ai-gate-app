/**
 * POST /api/marketing/copy
 * 文案產出單元 — Claude Sonnet 生成多平台行銷文案
 *
 * Body: {
 *   copyTypes: CopyType[]           // 要產出的文案類型
 *   userInstructions?: string       // 使用者自訂規定（選填）
 *   companyData?: object            // 來自單元2
 *   analysisData?: object           // 來自單元3
 *   collectedSummary?: string       // 來自單元1
 *   feedback?: string               // 修改意見（重新生成時）
 *   // legacy
 *   analysis?: string
 *   companyName?: string
 *   topic?: string
 *   industry?: string
 * }
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getCronOrUserAuth } from '@/lib/cron-auth'
import { createAnthropic } from '@ai-sdk/anthropic'
import { generateText } from 'ai'

export const maxDuration = 120

type CopyType =
  | 'facebook_post'
  | 'instagram_caption'
  | 'threads_post'
  | 'line_message'
  | 'twitter_post'
  | 'linkedin_post'
  | 'youtube_description'
  | 'ad_headline'
  | 'email_subject'
  | 'email_body'
  | 'press_release'

const COPY_TYPE_SPECS: Record<CopyType, { name: string; len: string; style: string }> = {
  facebook_post:      { name: 'Facebook 貼文',     len: '200-400字',    style: '可長篇，含標題+內文+CTA+3-5個hashtag' },
  instagram_caption:  { name: 'Instagram 說明',    len: '100-150字',    style: '簡潔有力，情感共鳴，換行分段，5-10個hashtag' },
  threads_post:       { name: 'Threads 貼文',      len: '80-120字',     style: '對話式，輕鬆自然，引發討論，2-3個hashtag' },
  line_message:       { name: 'LINE 訊息',         len: '50-100字',     style: '親切溫暖，適合私訊或群發，加 emoji，附連結提示' },
  twitter_post:       { name: 'Twitter/X 推文',   len: '最多140字',     style: '精準有力，含關鍵字，1-2個hashtag' },
  linkedin_post:      { name: 'LinkedIn 貼文',     len: '150-300字',    style: '專業正式，分享洞察或成就，商業受眾導向' },
  youtube_description:{ name: 'YouTube 說明欄',    len: '200-400字',    style: '含關鍵字SEO、影片摘要、時間軸標記提示、連結' },
  ad_headline:        { name: '廣告標題組',        len: '每則15字以內',   style: '產出5組不同訴求的廣告標題（痛點/好奇/利益/恐懼/社會認同）' },
  email_subject:      { name: 'Email 主旨',        len: '30-50字',      style: '產出3組不同風格主旨，提升開信率' },
  email_body:         { name: 'Email 內文',        len: '300-500字',    style: '結構化：開頭問候→痛點引導→解決方案→CTA→結尾' },
  press_release:      { name: '新聞稿',            len: '400-600字',    style: '正式新聞稿格式：標題+導言+內文+公司簡介+聯絡資訊' },
}

export async function POST(req: NextRequest) {
  const authUser = await getCronOrUserAuth(req)
  if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const supabase = await createClient()

  const body = await req.json()
  const {
    copyTypes = ['facebook_post', 'instagram_caption'],
    userInstructions = '',
    companyData,
    analysisData,
    collectedSummary,
    feedback,
    // legacy
    analysis,
    companyName: legacyName,
    topic,
    industry,
  } = body

  const selectedTypes: CopyType[] = copyTypes

  // Build context
  const company = companyData ?? {}
  const companyCtx = `
公司名稱：${company.companyName ?? legacyName ?? '品牌'}
產業：${company.industry ?? industry ?? ''}
主要產品/服務：${company.products ?? ''}
目標客群：${company.targetAudience ?? ''}
品牌語調：${company.brandTone ?? ''}
競爭優勢：${company.competitiveAdvantage ?? ''}`.trim()

  const analysisCtx = analysisData?.results
    ? Object.values(analysisData.results as Record<string, string>).join('\n\n').slice(0, 3000)
    : (analysis ?? '')

  const marketCtx = collectedSummary ? `\n\n市場調查摘要：\n${collectedSummary.slice(0, 2000)}` : ''

  const feedbackSection = feedback ? `\n\n⚠️ 修改意見：${feedback}\n請根據以上意見調整文案。` : ''

  const userRules = userInstructions
    ? `\n\n📌 使用者特別規定：\n${userInstructions}`
    : ''

  const typeSpecs = selectedTypes
    .map(t => {
      const spec = COPY_TYPE_SPECS[t]
      return `【${spec.name}】\n字數：${spec.len}\n格式：${spec.style}`
    })
    .join('\n\n')

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: 'ANTHROPIC_API_KEY 未設定' }, { status: 500 })
  }

  if (selectedTypes.length === 0) {
    return NextResponse.json({ error: '請先選擇至少一種文案類型' }, { status: 400 })
  }

  try {
    const anthropic = createAnthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

    const { text } = await generateText({
      model: anthropic('claude-sonnet-4-5'),
      system: `你是一位頂尖的多平台行銷文案撰寫人，擅長根據品牌特性與受眾習慣，撰寫各平台最佳化的行銷文案。
文案要：具感染力、清晰傳遞價值主張、符合各平台格式規範、促進轉換行動。
輸出格式：每個文案類型用「===【類型名稱】===」作為分隔標題，直接輸出文案內容，不需其他說明。`,
      messages: [
        {
          role: 'user',
          content: `請根據以下品牌資料與分析，為各平台撰寫行銷文案：

【品牌資料】
${companyCtx}
${topic ? `行銷主題：${topic}` : ''}

【市場分析摘要】
${analysisCtx || '（未提供分析資料）'}
${marketCtx}
${userRules}
${feedbackSection}

【請產出以下文案】
${typeSpecs}

請確保各平台文案風格符合該平台用戶習慣，直接輸出可發布的文案。`,
        },
      ],
      maxOutputTokens: 2000,
    })

    // Parse sections by type
    const results: Record<string, string> = {}
    for (const t of selectedTypes) {
      const spec = COPY_TYPE_SPECS[t]
      const regex = new RegExp(`===【${spec.name}】===[\\s\\S]*?(?====【|$)`, 'g')
      const match = text.match(regex)
      results[t] = match
        ? match[0].replace(`===【${spec.name}】===`, '').trim()
        : text
    }

    return NextResponse.json({ results, types: selectedTypes, fullText: text })
  } catch (err) {
    console.error('[copy]', err)
    return NextResponse.json({ error: `文案生成失敗：${String(err)}` }, { status: 500 })
  }
}
