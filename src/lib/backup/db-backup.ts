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

async function ensureSubfolder(token: string, parentId: string, name: string): Promise<string> {
  const q = `'${parentId}' in parents and name = '${name.replace(/'/g, "\\'")}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`
  const list = await driveJson(`${DRIVE_API}/files?q=${encodeURIComponent(q)}&fields=files(id)&pageSize=1`, token)
  if (list?.files?.[0]?.id) return list.files[0].id as string
  const created = await driveJson(`${DRIVE_API}/files?fields=id`, token, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, mimeType: 'application/vnd.google-apps.folder', parents: [parentId] }),
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

/** 企業版（專屬客製）或 MAX 方案的公司一律自動備份；其他公司需管理者開啟付費加購 */
export async function getCompanyBackupTargets(): Promise<{ id: string; name: string; plan: string; auto: boolean; enabled: boolean }[]> {
  const admin = createAdminClient()
  const [{ data: companies }, { data: subs }, { data: opts }] = await Promise.all([
    admin.from('companies').select('id, name').order('name'),
    admin.from('company_subscriptions').select('company_id, plan, status, enterprise, current_period_end'),
    admin.from('company_backup_settings').select('company_id, enabled'),
  ])
  const subMap = new Map((subs ?? []).map((s: { company_id: string }) => [s.company_id, s]))
  const optMap = new Map((opts ?? []).map((o: { company_id: string; enabled: boolean }) => [o.company_id, o.enabled]))
  return (companies ?? []).map((c: { id: string; name: string }) => {
    const s = subMap.get(c.id) as { plan?: string; status?: string; enterprise?: boolean; current_period_end?: string | null } | undefined
    const active = s?.status === 'active' && (!s.current_period_end || new Date(s.current_period_end).getTime() > Date.now())
    const auto = !!active && (!!s?.enterprise || s?.plan === 'max')
    const plan = !active ? 'free' : s?.enterprise ? '企業版' : (s?.plan ?? 'free')
    return { id: c.id, name: c.name, plan, auto, enabled: auto || !!optMap.get(c.id) }
  })
}

type Row = Record<string, unknown>

export async function runDbBackup(): Promise<{ ok: boolean; files?: string[]; tables?: number; rows?: number; sizeKb?: number; pruned?: number; error?: string }> {
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

    // 逐表匯出全部資料
    const data: Record<string, Row[]> = {}
    let rows = 0
    for (const t of (tables ?? []) as string[]) {
      const { data: arr, error } = await admin.rpc('backup_table_json', { t })
      if (error) throw new Error(`匯出 ${t} 失敗：${error.message}`)
      data[t] = (arr ?? []) as Row[]
      rows += data[t].length
    }

    // 使用者 → 公司對照（大部分資料表只記 owner_id / user_id）
    const userCompany = new Map<string, string>()
    for (const p of data.profiles ?? []) if (p.company_id) userCompany.set(String(p.id), String(p.company_id))
    const companyOf = (table: string, r: Row): string | null => {
      if (table === 'companies') return String(r.id)
      if (r.company_id) return String(r.company_id)
      for (const k of ['owner_id', 'user_id']) {
        const c = r[k] ? userCompany.get(String(r[k])) : undefined
        if (c) return c
      }
      return null
    }

    const targets = (await getCompanyBackupTargets()).filter(t => t.enabled)
    const now = new Date()
    const stamp = now.toISOString().slice(0, 16).replace(/[-:T]/g, '')
    const rootId = await ensureFolder(token, settings.folder_id)
    const files: string[] = []
    let sizeKb = 0
    let pruned = 0

    const put = async (folderName: string, fileName: string, payload: Record<string, Row[]>, meta: Record<string, unknown>) => {
      const json = JSON.stringify({ generated_at: now.toISOString(), ...meta, tables: payload })
      const gz = gzipSync(Buffer.from(json, 'utf8'))
      const folderId = await ensureSubfolder(token, rootId, folderName)
      await uploadFile(token, folderId, fileName, gz)
      pruned += await pruneOld(token, folderId)
      files.push(`${folderName}/${fileName}`)
      sizeKb += Math.round(gz.length / 1024)
    }

    // 1. 完整備份（整庫還原用）
    await put('完整備份', `aigate-db-full-${stamp}.json.gz`, data, { scope: 'full' })

    // 2. 依公司分檔（只含該公司的資料列）
    for (const c of targets) {
      const payload: Record<string, Row[]> = {}
      for (const [t, arr] of Object.entries(data)) {
        const own = arr.filter(r => companyOf(t, r) === c.id)
        if (own.length) payload[t] = own
      }
      const safe = c.name.replace(/[\\/:*?"<>|]/g, '_')
      await put(safe, `aigate-db-${safe}-${stamp}.json.gz`, payload, { scope: 'company', company_id: c.id, company_name: c.name })
    }

    const count = (tables ?? []).length
    await record({ folder_id: rootId, last_status: `成功：${count} 張表、${rows} 筆；公司 ${targets.length} 家`, last_file: files.join('、') })
    return { ok: true, files, tables: count, rows, sizeKb, pruned }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    await record({ last_status: `失敗：${msg}` })
    return { ok: false, error: msg }
  }
}
