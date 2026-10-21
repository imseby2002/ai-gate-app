import { NextRequest, NextResponse } from 'next/server'
import { getCronOrUserAuth } from '@/lib/cron-auth'
import { setUsageUser, trackLlm, withUsage } from '@/lib/marketing/usage'
import { precheckUsage } from '@/lib/marketing/billing'
import { getOfficeTieredModel } from '@/lib/office/tiered-chat-model'
import { currentDataOwner, loadCompanyProfile } from '@/lib/company/profile'
import { generateText } from 'ai'
import { langInstruction } from '@/lib/marketing/lang'

export const maxDuration = 60

export const POST = withUsage('[marketing] 潛在客戶腳本AI生成', async function POST(req: NextRequest) {
  const authUser = await getCronOrUserAuth(req)
  if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  setUsageUser(authUser.id)

  const usagePrecheck = await precheckUsage(authUser.id, 0.05)
  if (usagePrecheck) return NextResponse.json(usagePrecheck, { status: 402 })

  const body = await req.json().catch(() => ({}))
  const {
    channel = 'phone', // 'phone' | 'email' | 'sms'
    topic = '',
    targetAudience = '',
    tone = '',
    language = 'zh-TW',
    existingScript = '',
  } = body

  // 取得公司品牌背景
  let brandCtx = ''
  try {
    const c = await currentDataOwner()
    if (c) {
      const profile = await loadCompanyProfile(c.admin, c.ownerId)
      if (profile) {
        brandCtx = [
          profile.companyName && `公司名稱：${profile.companyName}`,
          profile.industry && `產業分類：${profile.industry}`,
          profile.products && `主要產品/服務：${profile.products}`,
          profile.targetAudience && `目標客群：${profile.targetAudience}`,
          (profile.brandCore || profile.competitiveAdvantage) && `核心理念與賣點：${profile.brandCore || profile.competitiveAdvantage}`,
          profile.website && `聯絡資訊/官方網站：${profile.website}`,
        ].filter(Boolean).join('\n')
      }
    }
  } catch {
    // skip
  }

  let promptRequirement = ''
  let responseFormat = ''

  if (channel === 'phone') {
    promptRequirement = `
【電話行銷語音腳本要求】
- 長度約 40-75 秒，適合 ElevenLabs / TTS 語音朗讀
- 語氣自然、口語化、親切且有禮貌，多用短句與適度停頓，避免晦澀的書面語
- 結構包含：
  1. 親切開場與身份自我介紹
  2. 引起興趣的痛點或限時優惠（價值主張）
  3. 明確引導（例如：「若您有興趣，可以按 1 加入我們的官方 LINE 獲取專屬優惠碼」）
  4. 感謝與禮貌結尾
- 避免使用不可讀的符號、括號註解、Markdown 或網址（因為這是給 TTS 朗讀的純口播文字）`
    responseFormat = `請以純 JSON 格式回傳，格式如下：
{
  "name": "腳本名稱（簡短描述）",
  "text": "電話口播完整腳本逐字稿"
}`
  } else if (channel === 'email') {
    promptRequirement = `
【Email 行銷開發信要求】
- 結構包含：吸睛主旨（Subject）與專業說服力的內文（Body）
- 主旨：30-50 字以內，具備高開信率特徵（痛點解決、好奇心或明確價值）
- 內文：結構清晰，包含問候稱呼、破題價值點、產品優勢、客戶獲益、清楚的行動呼籲（Call To Action）、署名結尾
- 排版整潔，換行適當，方便快速閱讀`
    responseFormat = `請以純 JSON 格式回傳，格式如下：
{
  "name": "模板名稱（簡短描述）",
  "subject": "Email 主旨",
  "body": "Email 完整內文（包含換行）"
}`
  } else {
    // sms
    promptRequirement = `
【行銷簡訊 SMS 要求】
- 字數嚴格控制在 70 字以內（單則簡訊限制）
- 精簡有力、吸睛吸引點擊
- 包含強烈行動呼籲（CTA），並在適當位置預留短網址佔位符（例如：詳情點此 https://...）`
    responseFormat = `請以純 JSON 格式回傳，格式如下：
{
  "name": "模板名稱（簡短描述）",
  "body": "70字以內的簡訊內文"
}`
  }

  const systemPrompt = `你是一位精通 B2B/B2C 潛在客戶開發與高轉換銷售話術的行銷專家。
請依據提供的公司背景、推廣主題與目標受眾，產出最專業、高轉換率的行銷腳本。
${langInstruction(language)}
輸出要求：只回傳合法 JSON 字串，不得包含 markdown 標籤（如 \`\`\`json）或任何額外說明文字。`

  const userPrompt = [
    '【公司與品牌背景】',
    brandCtx || '未提供具體公司背景，請以優質專業品牌角度撰寫',
    '\n【本次行銷主題/訴求】',
    topic || '推廣品牌核心服務與近期特惠活動，主動開發潛在合作客戶',
    targetAudience ? `\n【目標受眾/產業】\n${targetAudience}` : '',
    tone ? `\n【期望語調】\n${tone}` : '',
    existingScript ? `\n【參考或待優化的現有腳本】\n${existingScript}` : '',
    '\n' + promptRequirement,
    '\n' + responseFormat,
  ].filter(Boolean).join('\n')

  try {
    const tiered = getOfficeTieredModel({ message: userPrompt })
    const { text, usage } = await generateText({
      model: tiered.model,
      system: systemPrompt,
      prompt: userPrompt,
      maxOutputTokens: 1200,
      temperature: 0.7,
    })

    trackLlm(tiered.modelId, usage)

    let cleanJson = text.trim()
    if (cleanJson.startsWith('```json')) cleanJson = cleanJson.slice(7)
    if (cleanJson.startsWith('```')) cleanJson = cleanJson.slice(3)
    if (cleanJson.endsWith('```')) cleanJson = cleanJson.slice(0, -3)
    cleanJson = cleanJson.trim()

    const parsed = JSON.parse(cleanJson)
    return NextResponse.json({
      ok: true,
      data: parsed,
    })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: `AI 生成失敗: ${msg}` }, { status: 500 })
  }
})
