import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { VISUAL_TEMPLATES, type VisualTemplate } from '@/lib/marketing/visual-templates'
import { IMAGE_COSTS, checkCredits, deductCredits, isBillableUser } from '@/lib/marketing/billing'
import { getMarketingEntitlements } from '@/lib/marketing/entitlements'
import { createAnthropic } from '@ai-sdk/anthropic'
import { generateText } from 'ai'

export const maxDuration = 120

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
      model: anthropic('claude-haiku-4-5'),
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

// 參考圖模式：將風格骨架轉為 Kontext 編輯指令，以原圖為主體；模板預設的人像詞移除，避免取代原圖主體（使用者描述可自行要求加人物）
// 模板中會指定/取代主體的片語（人像、情侶、紳士、表情臉、瓶罐盒等），參考圖模式下移除
const REFERENCE_SUBJECT_TERMS = /\b(portrait|fashion|person|people|couple|gentleman|expressive face|box or bottle)\b/i

function buildReferenceEditPrompt(stylePrompt: string, subject: string): string {
  const style = stylePrompt
    .split(',')
    .map(s => s.trim())
    .filter(s => s && !REFERENCE_SUBJECT_TERMS.test(s))
    .join(', ')
  return [
    'Use the input image as the main subject: keep its subject, objects, scene, layout and camera angle.',
    'Do not replace the original subject with a different one.',
    `Restyle the image with this look: ${style}.`,
    subject ? `Additional details: ${subject}.` : '',
    'Preserve the original identity and structure of the photo, mainly change lighting, color grading, styling and add design space.',
  ].filter(Boolean).join(' ')
}

// 多張參考圖：只能使用圖中出現的商品組合成畫面
function buildMultiReferencePrompt(stylePrompt: string, subject: string, count: number): string {
  const style = stylePrompt
    .split(',')
    .map(s => s.trim())
    .filter(s => s && !REFERENCE_SUBJECT_TERMS.test(s))
    .join(', ')
  return [
    `Combine the products from the ${count} input images into one composition.`,
    'Use only the products shown in the input images and keep each product\'s exact appearance, shape, colors and packaging.',
    'Do not add, invent or substitute any other products.',
    `Style the composition with this look: ${style}.`,
    subject ? `Additional details: ${subject}.` : '',
  ].filter(Boolean).join(' ')
}

// 參考圖模式：由 Claude 看圖擔任美術指導，依風格類型（雜誌、海報、促銷卡…）寫出完整版面的 Kontext 編輯指令
// 讓成品真正呈現該類型設計（版面重組、縮圖、背景處理、類型文案），而非只在原圖上疊字
async function directReferenceEdit(
  template: VisualTemplate,
  userText: string,
  images: string[],
): Promise<string | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return null
  const isMulti = images.length > 1

  try {
    const anthropic = createAnthropic({ apiKey })
    const { text } = await generateText({
      model: anthropic('claude-sonnet-4-6'),
      abortSignal: AbortSignal.timeout(25000),
      system: `You are an art director writing ONE editing instruction for the FLUX Kontext image editing model, which edits the given input image(s).
Goal: turn the input photo(s) into a finished design that unmistakably looks like the requested genre, not the original photo with text pasted on top.

Rules:
- First identify what the photo actually shows (e.g. hotel room, dish, product, person, storefront) and pick the fitting sub-genre (e.g. magazine: room/hotel -> travel & lifestyle magazine cover; person -> fashion cover with that person as cover model; food -> food magazine).
- The real subject from the input image(s) must stay recognizable and be the hero. Never replace it with a different subject.
- ${isMulti
  ? 'Use ONLY the products shown in the input images, keeping their exact appearance. Do not add, invent or substitute any other products.'
  : 'You may add genre-typical supporting elements (e.g. small inset photo panels of related scenes, graphic shapes, badges, stickers) as long as the input subject remains the main visual.'}
- Be decisive about layout: say how to reframe the photo (full-bleed, cropped, scaled down into a panel, inset frames), how to treat the background (blur, tint, paper texture, color block), and where each design element goes.
- Text: every text item must be quoted exactly, in English or numbers only, short (max 5 words each), at most 6 items, e.g. masthead "WANDER", cover lines "A QUIET STAY IN TOUCHENG". Derive text from the user's notes (romanize place names, e.g. 宜蘭頭城 -> Toucheng, Yilan); if there are no notes, write fitting generic text for the subject. Never use real trademarked magazine names.
- Output only the instruction in English, max 130 words, no preamble.`,
      messages: [{
        role: 'user',
        content: [
          ...images.map(image => ({ type: 'image' as const, image })),
          {
            type: 'text' as const,
            text: `Genre/style: ${template.title} — ${template.feeling}
Typical use: ${template.applicability}
Style keywords: ${template.positivePrompt}
Layout advice: ${template.paramAdvice}
User notes: ${userText?.trim() || '(none)'}`,
          },
        ],
      }],
      maxOutputTokens: 400,
    })
    const out = text.trim()
    return out || null
  } catch (e) {
    console.warn('[visual-generator] 參考圖美術指導失敗，改用預設指令:', e)
    return null
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
      imageUrls,
      aspectRatio,
      model = 'flux',
      action = 'generate_image', // 'synthesize_prompt' | 'generate_image'
    } = body

    const template = VISUAL_TEMPLATES.find(t => t.id === templateId) || VISUAL_TEMPLATES[0]
    const chosenAspect = aspectRatio || template.defaultAspect || '1:1'
    const maxRefs = template.maxReferenceImages ?? 1
    const refImages: string[] = (Array.isArray(imageUrls) ? imageUrls : imageUrl ? [imageUrl] : [])
      .filter((u: unknown): u is string => typeof u === 'string' && !!u)
      .slice(0, maxRefs)

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
    if (refImages.length) {
      if (!process.env.FAL_AI_API_KEY) return NextResponse.json({ error: 'FAL_AI_API_KEY 未設定' }, { status: 500 })
      const isMulti = refImages.length > 1
      const editPrompt = (await directReferenceEdit(template, userPrompt, refImages)) ?? (isMulti
        ? buildMultiReferencePrompt(template.positivePrompt, translatedSubject, refImages.length)
        : buildReferenceEditPrompt(template.positivePrompt, translatedSubject))
      revisedPrompt = editPrompt
      // 支援圖生圖 / 參考圖修改 (FLUX Kontext；多圖使用 Kontext Multi)
      const falRes = await fetch(isMulti ? 'https://fal.run/fal-ai/flux-pro/kontext/multi' : 'https://fal.run/fal-ai/flux-pro/kontext', {
        method: 'POST',
        headers: {
          Authorization: `Key ${process.env.FAL_AI_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...(isMulti ? { image_urls: refImages, aspect_ratio: chosenAspect === '4:5' ? '3:4' : chosenAspect } : { image_url: refImages[0] }),
          prompt: editPrompt,
          guidance_scale: 3.5,
          num_images: 1,
          output_format: 'jpeg',
          safety_tolerance: '2',
        }),
      })

      if (!falRes.ok) {
        const err = await falRes.json().catch(() => ({}))
        const d = err?.detail
        const msg = typeof d === 'string' ? d : Array.isArray(d) ? d.map((e: any) => e.msg ?? JSON.stringify(e)).join('; ') : '參考圖生成失敗'
        return NextResponse.json({ error: msg }, { status: 500 })
      }
      const falData = await falRes.json()
      tempUrl = falData?.images?.[0]?.url ?? ''
      if (!tempUrl) return NextResponse.json({ error: '參考圖生成失敗，請稍後再試' }, { status: 500 })
    }

    // 無參考圖，走標準文生圖
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
