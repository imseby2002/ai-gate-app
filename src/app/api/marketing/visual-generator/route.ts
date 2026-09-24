import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { VISUAL_TEMPLATES } from '@/lib/marketing/visual-templates'
import { IMAGE_COSTS, checkCredits, deductCredits, isBillableUser } from '@/lib/marketing/billing'
import { getMarketingEntitlements } from '@/lib/marketing/entitlements'
import { createAnthropic } from '@ai-sdk/anthropic'
import { generateText } from 'ai'

export const maxDuration = 60

const DALLE_SIZES: Record<string, string> = {
  '1:1':  '1024x1024',
  '4:5':  '1024x1792',
  '3:4':  '1024x1792',
  '9:16': '1024x1792',
  '16:9': '1792x1024',
}

const FAL_SIZES: Record<string, { width: number; height: number }> = {
  '1:1':  { width: 1024, height: 1024 },
  '4:5':  { width: 896,  height: 1120 },
  '3:4':  { width: 864,  height: 1152 },
  '9:16': { width: 768,  height: 1344 },
  '16:9': { width: 1344, height: 768  },
}

// 輔助將使用者的中文商品/促銷描述轉化為能與提示詞骨架無縫融合的英文細節
async function translateOrEnrichSubject(userText: string): Promise<string> {
  const trimmed = userText?.trim()
  if (!trimmed) return ''

  // 若已經全為英文字符，直接返回
  if (/^[\x00-\x7F]+$/.test(trimmed)) {
    return trimmed
  }

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return trimmed

  try {
    const anthropic = createAnthropic({ apiKey })
    const { text } = await generateText({
      model: anthropic('claude-3-5-haiku-latest'),
      messages: [{
        role: 'user',
        content: `Translate and describe the following product or marketing concept into concise, vivid English visual descriptors for an AI image prompt:
"${trimmed}"
Focus only on product subject, textures, appetizing or attractive details, and clear visual features. Output only the English phrase, no preamble or quotes.`,
      }],
      maxOutputTokens: 120,
    })
    return text.trim() || trimmed
  } catch {
    return trimmed
  }
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const body = await req.json()
    const {
      templateId,
      userPrompt = '',
      imageUrl,
      aspectRatio,
      model = 'flux',
      action = 'generate_image', // 'synthesize_prompt' | 'generate_image'
    } = body

    const template = VISUAL_TEMPLATES.find(t => t.id === templateId) || VISUAL_TEMPLATES[0]
    const chosenAspect = aspectRatio || template.defaultAspect || '1:1'

    // 1. 智慧組裝正向與負向提示詞
    const translatedSubject = await translateOrEnrichSubject(userPrompt)
    let synthesizedPositive = template.positivePrompt
    if (translatedSubject) {
      synthesizedPositive = `${template.positivePrompt}, featuring ${translatedSubject}, ultra high quality, commercial photography, stunning details`
    }
    const synthesizedNegative = template.negativePrompt

    // 若僅請求組裝提示詞骨架，直接返回
    if (action === 'synthesize_prompt') {
      return NextResponse.json({
        ok: true,
        template,
        positivePrompt: synthesizedPositive,
        negativePrompt: synthesizedNegative,
        aspectRatio: chosenAspect,
        translatedSubject,
      })
    }

    // 2. 方案與點數檢查
    const { plan, features } = await getMarketingEntitlements(supabase, user.id)
    if (!features.imageGen) {
      return NextResponse.json({ error: '目前方案未開放圖片產出，請升級至 PRO 以上', plan }, { status: 403 })
    }

    const cost = IMAGE_COSTS[model] ?? 0.05
    const billable = await isBillableUser(user.id)
    const check = await checkCredits(user.id, cost, billable)
    if (!check.ok) return NextResponse.json(check.payload, { status: 402 })

    let tempUrl = ''
    let revisedPrompt = synthesizedPositive

    // 3. 圖片生成
    if (imageUrl && model === 'flux' && process.env.FAL_AI_API_KEY) {
      // 支援圖生圖 / 參考圖修改 (FLUX Kontext)
      const falRes = await fetch('https://fal.run/fal-ai/flux-pro/kontext', {
        method: 'POST',
        headers: {
          Authorization: `Key ${process.env.FAL_AI_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          image_url: imageUrl,
          prompt: synthesizedPositive,
          guidance_scale: 3.5,
          num_images: 1,
          output_format: 'jpeg',
          safety_tolerance: '2',
        }),
      })

      if (falRes.ok) {
        const falData = await falRes.json()
        tempUrl = falData?.images?.[0]?.url ?? ''
      }
    }

    // 若非圖生圖或 Kontext 失敗，走標準文生圖
    if (!tempUrl) {
      if (model === 'dalle3') {
        const apiKey = process.env.OPENAI_API_KEY
        if (!apiKey) return NextResponse.json({ error: 'OPENAI_API_KEY 未設定' }, { status: 500 })

        const dalleRes = await fetch('https://api.openai.com/v1/images/generations', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
          body: JSON.stringify({
            model: 'dall-e-3',
            prompt: synthesizedPositive.slice(0, 1000),
            n: 1,
            size: DALLE_SIZES[chosenAspect] ?? '1024x1024',
            quality: 'standard',
            style: 'vivid',
            response_format: 'url',
          }),
        })

        if (!dalleRes.ok) {
          const err = await dalleRes.json().catch(() => ({}))
          return NextResponse.json({ error: err?.error?.message ?? 'DALL-E 生成失敗' }, { status: 500 })
        }
        const dalleData = await dalleRes.json()
        tempUrl = dalleData?.data?.[0]?.url ?? ''
        revisedPrompt = dalleData?.data?.[0]?.revised_prompt ?? synthesizedPositive

      } else {
        // FLUX (預設)
        const apiKey = process.env.FAL_AI_API_KEY
        if (!apiKey) return NextResponse.json({ error: 'FAL_AI_API_KEY 未設定' }, { status: 500 })

        const endpoint = model === 'nano' ? 'https://fal.run/fal-ai/fast-sdxl' : 'https://fal.run/fal-ai/flux/dev'
        const falRes = await fetch(endpoint, {
          method: 'POST',
          headers: { Authorization: `Key ${apiKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            prompt: synthesizedPositive,
            image_size: FAL_SIZES[chosenAspect] ?? { width: 1024, height: 1024 },
            num_inference_steps: 28,
            num_images: 1,
          }),
        })

        if (!falRes.ok) {
          const err = await falRes.json().catch(() => ({}))
          const d = err?.detail
          const msg = typeof d === 'string' ? d : Array.isArray(d) ? d.map((e: any) => e.msg ?? JSON.stringify(e)).join('; ') : 'FLUX 生成失敗'
          return NextResponse.json({ error: msg }, { status: 500 })
        }
        const falData = await falRes.json()
        tempUrl = falData?.images?.[0]?.url ?? ''
      }
    }

    if (!tempUrl) {
      return NextResponse.json({ error: '未收到生成的圖片內容' }, { status: 500 })
    }

    // 4. 下載並轉存至 Supabase Storage（永久存儲）
    let publicUrl = tempUrl
    try {
      const imgRes = await fetch(tempUrl)
      if (imgRes.ok) {
        const imgBuffer = await imgRes.arrayBuffer()
        const fileName = `${user.id}/template-${template.id}-${Date.now()}.png`
        const { error: uploadError } = await supabase.storage
          .from('marketing-assets')
          .upload(fileName, imgBuffer, { contentType: 'image/png', upsert: false })

        if (!uploadError) {
          const { data: pubData } = supabase.storage.from('marketing-assets').getPublicUrl(fileName)
          if (pubData?.publicUrl) publicUrl = pubData.publicUrl
        }
      }
    } catch (e) {
      console.warn('[visual-generator] 轉存 Supabase Storage 失敗，使用原臨時 URL:', e)
    }

    // 5. 扣點
    const deduct = await deductCredits(user.id, cost, `[marketing] 風格模板生成: ${template.title}`, billable)

    return NextResponse.json({
      ok: true,
      url: publicUrl,
      template,
      aspectRatio: chosenAspect,
      positivePrompt: synthesizedPositive,
      negativePrompt: synthesizedNegative,
      revisedPrompt,
      cost,
      balance: deduct.ok ? deduct.balance : undefined,
      generatedAt: new Date().toISOString(),
    })
  } catch (err: any) {
    console.error('[visual-generator] error:', err)
    return NextResponse.json({ error: err?.message || '內部伺服器錯誤' }, { status: 500 })
  }
}
