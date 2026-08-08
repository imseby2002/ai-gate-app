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

interface PlatformResult {
  platform: string
  ok: boolean
  postId?: string
  error?: string
}

// Exchange System User / User token → Page Access Token via /me/accounts
async function resolvePageToken(token: string, pageId: string): Promise<{ pageToken: string; debug: string }> {
  try {
    // Method 1: direct field lookup
    const r1 = await fetch(
      `https://graph.facebook.com/v19.0/${pageId}?fields=access_token&access_token=${token}`
    )
    const d1 = await r1.json()
    if (d1.access_token) return { pageToken: d1.access_token, debug: 'method1_ok' }
    const m1err = d1.error?.message ?? JSON.stringify(d1)

    // Method 2: list all managed pages and match by ID
    const r2 = await fetch(
      `https://graph.facebook.com/v19.0/me/accounts?access_token=${token}&limit=100`
    )
    const d2 = await r2.json()
    const pages = d2.data ?? []
    const match = pages.find((p: { id: string; access_token?: string }) => p.id === pageId)
    if (match?.access_token) return { pageToken: match.access_token, debug: 'method2_ok' }
    const m2ids = pages.map((p: { id: string }) => p.id).join(',') || 'empty'

    return { pageToken: token, debug: `exchange_failed: m1=${m1err}; m2_pages=[${m2ids}]` }
  } catch (e) {
    return { pageToken: token, debug: `exception: ${e}` }
  }
}

// ─── Facebook Graph API ────────────────────────────────────────────────────────
async function uploadFacebook(creds: Record<string, string>, imageUrls: string[], copyText: string): Promise<PlatformResult> {
  try {
    const { page_access_token: token, page_id } = creds
    if (!token || !page_id) return { platform: 'Facebook', ok: false, error: '未設定 Page Access Token 或 Page ID' }

    // Auto-exchange System User token / User token → Page Access Token
    const { pageToken, debug } = await resolvePageToken(token, page_id)
    const resolvedToPageToken = pageToken !== token

    const firstImage = imageUrls[0]
    // Download image first, then upload as binary (avoids Facebook URL accessibility issues)
    const imgRes = await fetch(firstImage)
    const imgBuffer = await imgRes.arrayBuffer()
    const contentType = imgRes.headers.get('content-type') ?? 'image/jpeg'
    const formData = new FormData()
    formData.append('source', new Blob([imgBuffer], { type: contentType }), 'image.jpg')
    formData.append('caption', copyText.slice(0, 2000))
    formData.append('access_token', pageToken)
    const res = await fetch(`https://graph.facebook.com/v19.0/${page_id}/photos`, {
      method: 'POST',
      body: formData,
    })
    const data = await res.json()
    if (!data.id) {
      const errCode = data.error?.code
      const errMsg = data.error?.message ?? 'Facebook 上傳失敗'
      if (errCode === 200) {
        const hint = resolvedToPageToken
          ? 'App 未申請 pages_manage_posts 或為 Development 模式'
          : `Token 無法換成 Page Token [${debug}]：請在產生權杖時同時勾選 pages_manage_posts + pages_read_engagement + pages_show_list`
        throw new Error(`${errMsg}（${hint}）`)
      }
      throw new Error(`${errMsg} [tokenResolution: ${debug}]`)
    }
    return { platform: 'Facebook', ok: true, postId: data.id }
  } catch (e) {
    return { platform: 'Facebook', ok: false, error: String(e) }
  }
}

// ─── Instagram Graph API ───────────────────────────────────────────────────────
async function uploadInstagram(creds: Record<string, string>, imageUrls: string[], copyText: string): Promise<PlatformResult> {
  try {
    const { access_token: token, ig_user_id } = creds
    if (!token || !ig_user_id) return { platform: 'Instagram', ok: false, error: '未設定 Access Token 或 IG User ID' }

    const firstImage = imageUrls[0]
    // Step 1: create media container
    const createRes = await fetch(`https://graph.facebook.com/v19.0/${ig_user_id}/media`, {
      method: 'POST',
      body: new URLSearchParams({
        image_url: firstImage,
        caption: copyText.slice(0, 2200),
        access_token: token,
      }),
    })
    const created = await createRes.json()
    if (!created.id) throw new Error(created.error?.message ?? 'IG 媒體容器建立失敗')

    // Step 2: publish
    const pubRes = await fetch(`https://graph.facebook.com/v19.0/${ig_user_id}/media_publish`, {
      method: 'POST',
      body: new URLSearchParams({ creation_id: created.id, access_token: token }),
    })
    const pub = await pubRes.json()
    if (!pub.id) throw new Error(pub.error?.message ?? 'IG 發布失敗')
    return { platform: 'Instagram', ok: true, postId: pub.id }
  } catch (e) {
    return { platform: 'Instagram', ok: false, error: String(e) }
  }
}

// ─── Threads API ───────────────────────────────────────────────────────────────
async function uploadThreads(creds: Record<string, string>, imageUrls: string[], copyText: string): Promise<PlatformResult> {
  try {
    const { access_token: token, threads_user_id } = creds
    if (!token || !threads_user_id) return { platform: 'Threads', ok: false, error: '未設定 Access Token 或 Threads User ID' }

    const firstImage = imageUrls[0]
    // Step 1: create container
    const createRes = await fetch(`https://graph.threads.net/v1.0/${threads_user_id}/threads`, {
      method: 'POST',
      body: new URLSearchParams({
        media_type: 'IMAGE',
        image_url: firstImage,
        text: copyText.slice(0, 500),
        access_token: token,
      }),
    })
    const created = await createRes.json()
    if (!created.id) throw new Error(created.error?.message ?? 'Threads 容器建立失敗')

    // Step 2: publish
    const pubRes = await fetch(`https://graph.threads.net/v1.0/${threads_user_id}/threads_publish`, {
      method: 'POST',
      body: new URLSearchParams({ creation_id: created.id, access_token: token }),
    })
    const pub = await pubRes.json()
    if (!pub.id) throw new Error(pub.error?.message ?? 'Threads 發布失敗')
    return { platform: 'Threads', ok: true, postId: pub.id }
  } catch (e) {
    return { platform: 'Threads', ok: false, error: String(e) }
  }
}

// ─── LinkedIn UGC Posts ────────────────────────────────────────────────────────
async function uploadLinkedIn(creds: Record<string, string>, imageUrls: string[], copyText: string): Promise<PlatformResult> {
  try {
    const { access_token: token, author_urn } = creds
    if (!token || !author_urn) return { platform: 'LinkedIn', ok: false, error: '未設定 Access Token 或 Author URN' }

    const body = {
      author: author_urn,
      lifecycleState: 'PUBLISHED',
      specificContent: {
        'com.linkedin.ugc.ShareContent': {
          shareCommentary: { text: copyText.slice(0, 3000) },
          shareMediaCategory: imageUrls.length > 0 ? 'IMAGE' : 'NONE',
          ...(imageUrls.length > 0 ? {
            media: imageUrls.slice(0, 9).map(url => ({
              status: 'READY',
              originalUrl: url,
            })),
          } : {}),
        },
      },
      visibility: { 'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC' },
    }

    const res = await fetch('https://api.linkedin.com/v2/ugcPosts', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        'X-Restli-Protocol-Version': '2.0.0',
      },
      body: JSON.stringify(body),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.message ?? 'LinkedIn 發布失敗')
    return { platform: 'LinkedIn', ok: true, postId: data.id }
  } catch (e) {
    return { platform: 'LinkedIn', ok: false, error: String(e) }
  }
}

// ─── Twitter/X API v2 ─────────────────────────────────────────────────────────
async function uploadTwitter(creds: Record<string, string>, copyText: string): Promise<PlatformResult> {
  try {
    const { api_key, api_secret, access_token, access_token_secret } = creds
    if (!api_key || !api_secret || !access_token || !access_token_secret) {
      return { platform: 'Twitter/X', ok: false, error: '未設定完整的 API 金鑰' }
    }

    // OAuth 1.0a signature
    const oauth = await buildOAuth1Header('POST', 'https://api.twitter.com/2/tweets', {}, {
      api_key, api_secret, access_token, access_token_secret,
    })

    const res = await fetch('https://api.twitter.com/2/tweets', {
      method: 'POST',
      headers: {
        Authorization: oauth,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ text: copyText.slice(0, 280) }),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.detail ?? data.title ?? 'Twitter 發布失敗')
    return { platform: 'Twitter/X', ok: true, postId: data.data?.id }
  } catch (e) {
    return { platform: 'Twitter/X', ok: false, error: String(e) }
  }
}

// ─── LINE VOOM ─────────────────────────────────────────────────────────────────
async function uploadLineVoom(creds: Record<string, string>, imageUrls: string[], copyText: string): Promise<PlatformResult> {
  try {
    const { channel_access_token } = creds
    if (!channel_access_token) return { platform: 'LINE VOOM', ok: false, error: '未設定 Channel Access Token' }

    // LINE VOOM Post (Timeline post via Messaging API)
    const res = await fetch('https://api.line.me/v2/bot/message/broadcast', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${channel_access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messages: [
          { type: 'text', text: copyText.slice(0, 2000) },
          ...(imageUrls.length > 0 ? [{
            type: 'image',
            originalContentUrl: imageUrls[0],
            previewImageUrl: imageUrls[0],
          }] : []),
        ],
      }),
    })
    if (!res.ok) {
      const err = await res.json()
      throw new Error(err.message ?? 'LINE VOOM 發布失敗')
    }
    return { platform: 'LINE VOOM', ok: true }
  } catch (e) {
    return { platform: 'LINE VOOM', ok: false, error: String(e) }
  }
}

// ─── Zalo OA ───────────────────────────────────────────────────────────────────
async function uploadZalo(creds: Record<string, string>, imageUrls: string[], copyText: string): Promise<PlatformResult> {
  try {
    const { access_token, oa_id } = creds
    if (!access_token || !oa_id) return { platform: 'Zalo', ok: false, error: '未設定 Access Token 或 OA ID' }

    // Zalo OA Article Post
    const res = await fetch('https://openapi.zalo.me/v2.0/article/create', {
      method: 'POST',
      headers: {
        access_token,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        type: 'normal',
        title: copyText.slice(0, 100),
        description: copyText.slice(0, 300),
        cover: imageUrls[0] ?? '',
        status: 'show',
        body: [{ type: 'text', content: copyText }],
      }),
    })
    const data = await res.json()
    if (data.error !== 0) throw new Error(data.message ?? 'Zalo 發布失敗')
    return { platform: 'Zalo', ok: true, postId: String(data.data?.token ?? '') }
  } catch (e) {
    return { platform: 'Zalo', ok: false, error: String(e) }
  }
}

// ─── FB Reels ──────────────────────────────────────────────────────────────────
async function uploadFbReels(creds: Record<string, string>, videoUrl: string, copyText: string): Promise<PlatformResult> {
  try {
    const { page_access_token: token, page_id } = creds
    if (!token || !page_id) return { platform: 'FB Reels', ok: false, error: '未設定 Facebook 憑證' }
    if (!videoUrl) return { platform: 'FB Reels', ok: false, error: '無影片 URL（影片尚未生成）' }

    // Step 1: Initialize upload session
    const initRes = await fetch(`https://graph.facebook.com/v19.0/${page_id}/video_reels`, {
      method: 'POST',
      body: new URLSearchParams({
        upload_phase: 'start',
        access_token: token,
      }),
    })
    const init = await initRes.json()
    if (!init.video_id) throw new Error(init.error?.message ?? 'FB Reels 初始化失敗')

    // Step 2: Finish with video URL
    const finishRes = await fetch(`https://graph.facebook.com/v19.0/${page_id}/video_reels`, {
      method: 'POST',
      body: new URLSearchParams({
        upload_phase: 'finish',
        video_id: init.video_id,
        video_state: 'PUBLISHED',
        description: copyText.slice(0, 2000),
        access_token: token,
        file_url: videoUrl,
      }),
    })
    const finish = await finishRes.json()
    if (!finish.success) throw new Error(finish.error?.message ?? 'FB Reels 發布失敗')
    return { platform: 'FB Reels', ok: true, postId: init.video_id }
  } catch (e) {
    return { platform: 'FB Reels', ok: false, error: String(e) }
  }
}

// ─── IG Reels ──────────────────────────────────────────────────────────────────
async function uploadIgReels(creds: Record<string, string>, videoUrl: string, copyText: string): Promise<PlatformResult> {
  try {
    const { access_token: token, ig_user_id } = creds
    if (!token || !ig_user_id) return { platform: 'IG Reels', ok: false, error: '未設定 Instagram 憑證' }
    if (!videoUrl) return { platform: 'IG Reels', ok: false, error: '無影片 URL（影片尚未生成）' }

    // Step 1: Create Reels container
    const createRes = await fetch(`https://graph.facebook.com/v19.0/${ig_user_id}/media`, {
      method: 'POST',
      body: new URLSearchParams({
        media_type: 'REELS',
        video_url: videoUrl,
        caption: copyText.slice(0, 2200),
        access_token: token,
      }),
    })
    const created = await createRes.json()
    if (!created.id) throw new Error(created.error?.message ?? 'IG Reels 容器建立失敗')

    // Step 2: Publish
    const pubRes = await fetch(`https://graph.facebook.com/v19.0/${ig_user_id}/media_publish`, {
      method: 'POST',
      body: new URLSearchParams({ creation_id: created.id, access_token: token }),
    })
    const pub = await pubRes.json()
    if (!pub.id) throw new Error(pub.error?.message ?? 'IG Reels 發布失敗')
    return { platform: 'IG Reels', ok: true, postId: pub.id }
  } catch (e) {
    return { platform: 'IG Reels', ok: false, error: String(e) }
  }
}

// ─── YouTube Shorts ────────────────────────────────────────────────────────────
async function uploadYouTube(creds: Record<string, string>, videoUrl: string, copyText: string): Promise<PlatformResult> {
  try {
    const { client_id, client_secret, refresh_token } = creds
    if (!client_id || !client_secret || !refresh_token) {
      return { platform: 'YouTube Shorts', ok: false, error: '未設定 YouTube OAuth 憑證' }
    }
    if (!videoUrl) return { platform: 'YouTube Shorts', ok: false, error: '無影片 URL（影片尚未生成）' }

    // Refresh access token
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id, client_secret, refresh_token,
        grant_type: 'refresh_token',
      }),
    })
    const tokenData = await tokenRes.json()
    if (!tokenData.access_token) throw new Error('YouTube Token 刷新失敗：' + (tokenData.error_description ?? tokenData.error))

    // Fetch video bytes
    const videoRes = await fetch(videoUrl)
    const videoBuffer = await videoRes.arrayBuffer()

    // Upload video
    const uploadRes = await fetch(
      'https://www.googleapis.com/upload/youtube/v3/videos?uploadType=multipart&part=snippet,status',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${tokenData.access_token}`,
          'Content-Type': 'multipart/related; boundary=boundary',
        },
        body: [
          '--boundary\r\nContent-Type: application/json\r\n\r\n',
          JSON.stringify({
            snippet: {
              title: copyText.slice(0, 100),
              description: copyText.slice(0, 5000),
              tags: ['Shorts'],
              categoryId: '22',
            },
            status: { privacyStatus: 'public' },
          }),
          '\r\n--boundary\r\nContent-Type: video/mp4\r\n\r\n',
          new Uint8Array(videoBuffer),
          '\r\n--boundary--',
        ].join(''),
      }
    )
    const uploadData = await uploadRes.json()
    if (!uploadData.id) throw new Error(uploadData.error?.message ?? 'YouTube 上傳失敗')
    return { platform: 'YouTube Shorts', ok: true, postId: uploadData.id }
  } catch (e) {
    return { platform: 'YouTube Shorts', ok: false, error: String(e) }
  }
}

// ─── TikTok ────────────────────────────────────────────────────────────────────
async function uploadTikTok(creds: Record<string, string>, videoUrl: string, copyText: string): Promise<PlatformResult> {
  try {
    const { access_token } = creds
    if (!access_token) return { platform: 'TikTok', ok: false, error: '未設定 Access Token' }
    if (!videoUrl) return { platform: 'TikTok', ok: false, error: '無影片 URL（影片尚未生成）' }

    // Step 1: Init upload
    const initRes = await fetch('https://open.tiktokapis.com/v2/post/publish/video/init/', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${access_token}`,
        'Content-Type': 'application/json; charset=UTF-8',
      },
      body: JSON.stringify({
        post_info: {
          title: copyText.slice(0, 150),
          privacy_level: 'SELF_ONLY',
          disable_duet: false,
          disable_comment: false,
          disable_stitch: false,
        },
        source_info: {
          source: 'PULL_FROM_URL',
          video_url: videoUrl,
        },
      }),
    })
    const initData = await initRes.json()
    if (initData.error?.code !== 'ok') throw new Error(initData.error?.message ?? 'TikTok 上傳初始化失敗')
    return { platform: 'TikTok', ok: true, postId: initData.data?.publish_id }
  } catch (e) {
    return { platform: 'TikTok', ok: false, error: String(e) }
  }
}

// ─── OAuth 1.0a Helper (Twitter) ──────────────────────────────────────────────
async function buildOAuth1Header(
  method: string,
  url: string,
  params: Record<string, string>,
  keys: { api_key: string; api_secret: string; access_token: string; access_token_secret: string }
): Promise<string> {
  const nonce = crypto.randomUUID().replace(/-/g, '')
  const timestamp = Math.floor(Date.now() / 1000).toString()

  const oauthParams: Record<string, string> = {
    oauth_consumer_key: keys.api_key,
    oauth_nonce: nonce,
    oauth_signature_method: 'HMAC-SHA256',
    oauth_timestamp: timestamp,
    oauth_token: keys.access_token,
    oauth_version: '1.0',
    ...params,
  }

  const sortedParams = Object.keys(oauthParams).sort()
    .map(k => `${encodeURIComponent(k)}=${encodeURIComponent(oauthParams[k])}`)
    .join('&')

  const baseString = [method.toUpperCase(), encodeURIComponent(url), encodeURIComponent(sortedParams)].join('&')
  const signingKey = `${encodeURIComponent(keys.api_secret)}&${encodeURIComponent(keys.access_token_secret)}`

  const encoder = new TextEncoder()
  const cryptoKey = await crypto.subtle.importKey(
    'raw', encoder.encode(signingKey), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  )
  const sigBytes = await crypto.subtle.sign('HMAC', cryptoKey, encoder.encode(baseString))
  const signature = btoa(String.fromCharCode(...new Uint8Array(sigBytes)))

  const headerParams: Record<string, string> = { ...oauthParams, oauth_signature: signature }
  const header = Object.keys(headerParams)
    .filter(k => k.startsWith('oauth_'))
    .map(k => `${encodeURIComponent(k)}="${encodeURIComponent(headerParams[k])}"`)
    .join(', ')

  return `OAuth ${header}`
}

// ─── Main Handler ──────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { platforms, imageUrls = [], videoUrl = '', copyText = '' } = await req.json()
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

  const credMap: Record<string, Record<string, string>> = {}
  for (const row of credRows ?? []) {
    if (row.is_connected) credMap[row.platform] = row.credentials
  }

  // Dispatch uploads in parallel
  const tasks = platforms.map((p: string) => {
    const creds = credMap[p] ?? {}
    switch (p) {
      case 'Facebook':      return uploadFacebook(creds, imageUrls, copyText)
      case 'Instagram':     return uploadInstagram(creds, imageUrls, copyText)
      case 'Threads':       return uploadThreads(creds, imageUrls, copyText)
      case 'LinkedIn':      return uploadLinkedIn(creds, imageUrls, copyText)
      case 'Twitter/X':     return uploadTwitter(creds, copyText)
      case 'LINE VOOM':     return uploadLineVoom(creds, imageUrls, copyText)
      case 'Zalo':          return uploadZalo(creds, imageUrls, copyText)
      case 'FB Reels':      return uploadFbReels(credMap['Facebook'] ?? {}, videoUrl, copyText)
      case 'IG Reels':      return uploadIgReels(credMap['Instagram'] ?? {}, videoUrl, copyText)
      case 'YouTube Shorts': return uploadYouTube(creds, videoUrl, copyText)
      case 'TikTok':        return uploadTikTok(creds, videoUrl, copyText)
      default: return Promise.resolve({ platform: p, ok: false, error: '不支援的平台' } as PlatformResult)
    }
  })

  const results = await Promise.all(tasks)
  return NextResponse.json({ results })
}
