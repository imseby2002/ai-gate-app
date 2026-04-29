const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token'
const DRIVE_API = 'https://www.googleapis.com/drive/v3'

export function getOAuthUrl(redirectUri: string, state?: string): string {
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID!,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'https://www.googleapis.com/auth/drive.readonly email profile',
    access_type: 'offline',
    prompt: 'consent',
    ...(state ? { state } : {}),
  })
  return `https://accounts.google.com/o/oauth2/v2/auth?${params}`
}

export async function exchangeCode(code: string, redirectUri: string) {
  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    }),
  })
  return res.json() as Promise<{
    access_token: string
    refresh_token?: string
    expires_in: number
    token_type: string
    error?: string
  }>
}

export async function refreshAccessToken(refreshToken: string): Promise<string | null> {
  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  })
  const data = await res.json()
  return data.access_token ?? null
}

export async function getDriveUserEmail(accessToken: string): Promise<string> {
  const res = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  const data = await res.json()
  return data.email ?? ''
}

export async function listFolders(accessToken: string, parentId = 'root') {
  const q = `'${parentId}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`
  const res = await fetch(
    `${DRIVE_API}/files?q=${encodeURIComponent(q)}&fields=files(id,name)&pageSize=100&orderBy=name`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  )
  const data = await res.json()
  return (data.files ?? []) as { id: string; name: string }[]
}

export async function listImages(accessToken: string, folderId: string) {
  const q = `'${folderId}' in parents and mimeType contains 'image/' and trashed = false`
  const res = await fetch(
    `${DRIVE_API}/files?q=${encodeURIComponent(q)}&fields=files(id,name,mimeType,thumbnailLink)&pageSize=200`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  )
  const data = await res.json()
  return (data.files ?? []) as { id: string; name: string; mimeType: string; thumbnailLink?: string }[]
}

export async function downloadImageAsBase64(accessToken: string, fileId: string): Promise<{ base64: string; mimeType: string }> {
  // Get file metadata first
  const metaRes = await fetch(`${DRIVE_API}/files/${fileId}?fields=mimeType,size`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  const meta = await metaRes.json()
  const mimeType: string = meta.mimeType ?? 'image/jpeg'

  // Download file content
  const dlRes = await fetch(`${DRIVE_API}/files/${fileId}?alt=media`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  const buffer = await dlRes.arrayBuffer()
  const base64 = Buffer.from(buffer).toString('base64')
  return { base64, mimeType }
}
