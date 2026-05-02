/**
 * POST /api/integrations/google-drive/random-image
 * Body: { folderId: string }
 * Returns: { fileId, name, base64, mimeType, dataUrl }
 * - base64/dataUrl for browser display and Claude Vision
 * - also uploads to Supabase Storage and returns publicUrl for img2img/img2video APIs
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getValidAccessToken } from '@/lib/drive-token'
import { listImages, downloadImageAsBase64 } from '@/lib/google-drive'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { folderId } = await req.json()
  if (!folderId) return NextResponse.json({ error: 'folderId required' }, { status: 400 })

  const token = await getValidAccessToken(user.id)
  if (!token) return NextResponse.json({ error: 'Google Drive not connected' }, { status: 403 })

  const images = await listImages(token, folderId)
  if (images.length === 0) return NextResponse.json({ error: '資料夾內沒有圖片' }, { status: 404 })

  // Pick random image
  const picked = images[Math.floor(Math.random() * images.length)]
  const { base64, mimeType } = await downloadImageAsBase64(token, picked.id)

  // Upload to Supabase Storage so img2img/img2video APIs can use a public URL
  const ext = mimeType.split('/')[1]?.replace('jpeg', 'jpg') ?? 'jpg'
  const storagePath = `drive-ref/${user.id}/${picked.id}.${ext}`
  const buffer = Buffer.from(base64, 'base64')
  const { error: upErr } = await supabase.storage
    .from('marketing')
    .upload(storagePath, buffer, { contentType: mimeType, upsert: true })

  let publicUrl = ''
  if (!upErr) {
    const { data: urlData } = supabase.storage.from('marketing').getPublicUrl(storagePath)
    publicUrl = urlData.publicUrl
  }

  return NextResponse.json({
    fileId: picked.id,
    name: picked.name,
    mimeType,
    dataUrl: `data:${mimeType};base64,${base64}`,
    publicUrl,
  })
}
