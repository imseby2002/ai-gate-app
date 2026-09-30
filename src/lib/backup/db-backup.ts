// 全資料庫每日備份：逐表匯出 public schema 為 JSON，gzip 後上傳至管理者授權的 Google Drive 資料夾，保留 30 天
import { gzipSync } from 'zlib'
import { createAdminClient } from '@/lib/supabase/admin'
import { refreshAccessToken } from '@/lib/google-drive'

const DRIVE_API = 'https://www.googleapis.com/drive/v3'
const UPLOAD_API = 'https://www.googleapis.com/upload/drive/v3'
const FOLDER_NAME = 'AI-GATE 資料庫備份'
const RETENTION_DAYS = 30
export const BACKUP_SETTINGS_ID = 'gdrive'

export function getBackupOAuthUrl(redirectUri: string, state: string): string {
  const clientId = process.env.GOOGLE_CLIENT_ID
  if (!clientId) throw new Error('GOOGLE_CLIENT_ID 未設定')
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    // drive.file：只能存取本系統建立的檔案，不會讀到 Drive 其他內容
    scope: 'https://www.googleapis.com/auth/drive.file email',
    access_type: 'offline',
    prompt: 'select_account consent',
    state,
  })
  return `https://accounts.google.com/o/oauth2/v2/auth?${params}`
}

async function driveJson(url: string, token: string, init: RequestInit = {}) {
  const res = await fetch(url, { ...init, headers: { Authorization: `Bearer ${token}`, ...(init.headers ?? {}) } })
  if (!res.ok) throw new Error(`Drive API ${res.status}: ${await res.text()}`)
  return res.status === 204 ? null : res.json()
}

async function ensureFolder(token: string, folderId: string): Promise<string> {
  if (folderId) {
    const res = await fetch(`${DRIVE_API}/files/${folderId}?fields=id,trashed`, { headers: { Authorization: `Bearer ${token}` } })
    if (res.ok) {
      const f = await res.json()
      if (!f.trashed) return folderId
    }
  }
  const created = await driveJson(`${DRIVE_API}/files?fields=id`, token, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: FOLDER_NAME, mimeType: 'application/vnd.google-apps.folder' }),
  })
  return created.id as string
}

async function uploadFile(token: string, folderId: string, name: string, data: Buffer): Promise<string> {
  // 可續傳上傳（resumable），不受 multipart 5MB 限制
  const init = await fetch(`${UPLOAD_API}/files?uploadType=resumable&fields=id`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json; charset=UTF-8',
      'X-Upload-Content-Type': 'application/gzip',
      'X-Upload-Content-Length': String(data.length),
    },
    body: JSON.stringify({ name, parents: [folderId], mimeType: 'application/gzip' }),
  })
  if (!init.ok) throw new Error(`Drive 上傳初始化失敗 ${init.status}: ${await init.text()}`)
  const location = init.headers.get('location')
  if (!location) throw new Error('Drive 上傳初始化未回傳位置')
  const put = await fetch(location, { method: 'PUT', headers: { 'Content-Type': 'application/gzip' }, body: new Uint8Array(data) })
  if (!put.ok) throw new Error(`Drive 上傳失敗 ${put.status}: ${await put.text()}`)
  const f = await put.json()
  return f.id as string
}

async function pruneOld(token: string, folderId: string): Promise<number> {
  const cutoff = new Date(Date.now() - RETENTION_DAYS * 86400_000).toISOString()
  const q = `'${folderId}' in parents and trashed = false and createdTime < '${cutoff}'`
  const list = await driveJson(`${DRIVE_API}/files?q=${encodeURIComponent(q)}&fields=files(id)&pageSize=100`, token)
  let n = 0
  for (const f of (list?.files ?? []) as { id: string }[]) {
    await driveJson(`${DRIVE_API}/files/${f.id}`, token, { method: 'DELETE' })
    n++
  }
  return n
}

export async function runDbBackup(): Promise<{ ok: boolean; file?: string; tables?: number; rows?: number; sizeKb?: number; pruned?: number; error?: string }> {
  const admin = createAdminClient()
  const { data: settings } = await admin.from('system_backup_settings').select('*').eq('id', BACKUP_SETTINGS_ID).maybeSingle()
  if (!settings?.refresh_token) return { ok: false, error: '尚未連結 Google Drive' }

  const record = (patch: Record<string, unknown>) =>
    admin.from('system_backup_settings').update({ ...patch, last_run_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq('id', BACKUP_SETTINGS_ID)

  try {
    const token = await refreshAccessToken(settings.refresh_token)
    if (!token) throw new Error('Google 授權已失效，請重新連結')

    const { data: tables, error: listErr } = await admin.rpc('backup_list_tables')
    if (listErr) throw new Error(`列出資料表失敗：${listErr.message}`)

    const parts: string[] = []
    let rows = 0
    for (const t of (tables ?? []) as string[]) {
      const { data, error } = await admin.rpc('backup_table_json', { t })
      if (error) throw new Error(`匯出 ${t} 失敗：${error.message}`)
      const arr = (data ?? []) as unknown[]
      rows += arr.length
      parts.push(`${JSON.stringify(t)}:${JSON.stringify(arr)}`)
    }
    const now = new Date()
    const json = `{"generated_at":${JSON.stringify(now.toISOString())},"tables":{${parts.join(',')}}}`
    const gz = gzipSync(Buffer.from(json, 'utf8'))

    const folderId = await ensureFolder(token, settings.folder_id)
    const stamp = now.toISOString().slice(0, 16).replace(/[-:T]/g, '')
    const name = `aigate-db-${stamp}.json.gz`
    await uploadFile(token, folderId, name, gz)
    const pruned = await pruneOld(token, folderId)

    const count = (tables ?? []).length
    await record({ folder_id: folderId, last_status: `成功：${count} 張表、${rows} 筆`, last_file: name })
    return { ok: true, file: name, tables: count, rows, sizeKb: Math.round(gz.length / 1024), pruned }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    await record({ last_status: `失敗：${msg}` })
    return { ok: false, error: msg }
  }
}
