/**
 * POST /api/marketing/generate-image
 * 圖片產出單元 — DALL-E 3 生成行銷圖片並存入 Supabase Storage
 *
 * Body: {
 *   prompt: string          // AI 生成 Prompt
 *   scriptId: number        // 對應圖片腳本編號
 *   size?: '1024x1024' | '1792x1024' | '1024x1792'
 *   quality?: 'standard' | 'hd'
 *   style?: 'vivid' | 'natural'
 * }
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const maxDuration = 60

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const {
    prompt,
    scriptId = 0,
    size = '1024x1024',
    quality = 'standard',
    style = 'vivid',
  } = body

  if (!prompt?.trim()) {
    return NextResponse.json({ error: 'Prompt 不可為空' }, { status: 400 })
  }

  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'OPENAI_API_KEY 未設定' }, { status: 500 })
  }

  // ── 1. 呼叫 DALL-E 3 ──────────────────────────────────────────────────────
  const dalleRes = await fetch('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'dall-e-3',
      prompt: prompt.trim(),
      n: 1,
      size,
      quality,
      style,
      response_format: 'url',
    }),
  })

  if (!dalleRes.ok) {
    const err = await dalleRes.json().catch(() => ({ error: { message: dalleRes.statusText } }))
    const msg = err?.error?.message ?? 'DALL-E 生成失敗'
    return NextResponse.json({ error: msg }, { status: 500 })
  }

  const dalleData = await dalleRes.json()
  const tempUrl: string = dalleData?.data?.[0]?.url ?? ''
  const revisedPrompt: string = dalleData?.data?.[0]?.revised_prompt ?? prompt

  if (!tempUrl) {
    return NextResponse.json({ error: '未收到圖片 URL' }, { status: 500 })
  }

  // ── 2. 下載圖片並上傳至 Supabase Storage ──────────────────────────────────
  const imgRes = await fetch(tempUrl)
  if (!imgRes.ok) {
    return NextResponse.json({ error: '無法下載 DALL-E 圖片' }, { status: 500 })
  }

  const imgBuffer = await imgRes.arrayBuffer()
  const timestamp = Date.now()
  const fileName = `${user.id}/img-script-${scriptId}-${timestamp}.png`

  const { error: uploadError } = await supabase.storage
    .from('marketing-assets')
    .upload(fileName, imgBuffer, {
      contentType: 'image/png',
      upsert: false,
    })

  if (uploadError) {
    return NextResponse.json({ error: `Storage 上傳失敗：${uploadError.message}` }, { status: 500 })
  }

  const { data: { publicUrl } } = supabase.storage
    .from('marketing-assets')
    .getPublicUrl(fileName)

  return NextResponse.json({
    url: publicUrl,
    revisedPrompt,
    scriptId,
    size,
    quality,
    style,
    generatedAt: new Date().toISOString(),
  })
}
