/**
 * POST /api/marketing/upload
 * 上傳行銷素材至各大社群平台
 *
 * Body: {
 *   campaignId: string
 *   platforms: string[]          // 選擇的平台
 *   imageUrls: string[]          // 圖片 URL（來自步驟 6）
 *   videoUrl?: string            // 影片 URL（來自步驟 10，選填）
 *   copyText: string             // 文案
 * }
 *
 * Response: {
 *   results: { platform: string; ok: boolean; postId?: string; error?: string }[]
 * }
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getMarketingEntitlements } from '@/lib/marketing/entitlements'
import { publishToPlatforms } from '@/lib/marketing/publish'

// ─── Main Handler ──────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const platforms = body.platforms
  const imageUrls: string[] = body.imageUrls ?? (Array.isArray(body.images) ? body.images.map((img: unknown) => typeof img === 'string' ? img : (img as { url?: string })?.url).filter(Boolean) : [])
  const videoUrl: string = body.videoUrl ?? (Array.isArray(body.videos) ? (body.videos[0]?.url ?? (typeof body.videos[0] === 'string' ? body.videos[0] : '')) : (typeof body.video === 'string' ? body.video : '')) ?? ''
  const copyText: string = (body.copyText ?? (Array.isArray(body.copies) ? body.copies.join('\n\n') : (typeof body.copies === 'string' ? body.copies : '')) ?? '').trim()

  if (!platforms?.length) return NextResponse.json({ error: 'platforms required' }, { status: 400 })

  const { plan, features } = await getMarketingEntitlements(supabase, user.id)
  if (!features.uploadPlatforms) {
    return NextResponse.json({ error: '目前方案未開放自動上傳平台，請升級至 PRO 以上', plan }, { status: 403 })
  }

  // Load all credentials for this user
  const { data: credRows } = await supabase
    .from('social_platform_credentials')
    .select('platform, credentials, is_connected')
    .eq('user_id', user.id)

  const results = await publishToPlatforms(credRows ?? [], platforms, imageUrls, videoUrl, copyText)
  return NextResponse.json({ results })
}
