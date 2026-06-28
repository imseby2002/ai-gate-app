// 各獨立系統的定義：每個系統有自己的登入/註冊入口，登入後 session 被限定在該系統。
// 切換系統需從另一系統的登入頁進入（會更新 scope cookie）。

export type SystemKey = 'chat' | 'booking' | 'cs' | 'marketing' | 'leads' | 'resume'

export interface SystemDef {
  key: SystemKey
  label: string
  desc: string
  home: string
  prefixes: string[]
}

export const SYSTEMS: Record<SystemKey, SystemDef> = {
  chat:      { key: 'chat',      label: 'AI 對話',    desc: '多模型智慧對話、助理與圖片／影片生成', home: '/apps',           prefixes: ['/apps', '/chat', '/assistants', '/image-gen', '/video-gen', '/usage'] },
  booking:   { key: 'booking',   label: '訂房系統',   desc: '房源、訂單、定價、線上訂房與通路同步', home: '/booking',        prefixes: ['/booking'] },
  cs:        { key: 'cs',        label: '客服系統',   desc: '多平台 AI 客服與知識庫', home: '/cs',             prefixes: ['/cs', '/marketing-auto'] },
  marketing: { key: 'marketing', label: '行銷中心', desc: '行銷內容生成與自動化流水線', home: '/marketing', prefixes: ['/marketing', '/marketing-auto', '/marketing-pipeline', '/prospect-call'] },
  leads:     { key: 'leads',     label: '開發信',     desc: '潛在客戶開發與外呼', home: '/prospect-call',  prefixes: ['/prospect-call'] },
  resume:    { key: 'resume',    label: '職場助手',   desc: 'AI 全方位職場助理', home: '/resume',         prefixes: ['/resume', '/hr'] },
}

export const SYSTEM_LIST: SystemDef[] = Object.values(SYSTEMS)

// 子域名 → 所屬系統（用於未登入登入導向與 OAuth callback 推斷）
// 不靠 systemForPath：/marketing-auto 同時屬 cs 與 marketing，路徑反查有歧義
export const SUBDOMAIN_SYSTEM: Record<string, SystemKey> = {
  cs:        'cs',
  booking:   'booking',
  marketing: 'marketing',
  chat:      'chat',
  work:      'resume',
}

// 系統 → 子域名（OAuth callback 後讓功能頁落回對應子域，避免停在 www）
export const SYSTEM_SUBDOMAIN: Partial<Record<SystemKey, string>> = {
  cs:        'cs',
  booking:   'booking',
  marketing: 'marketing',
  chat:      'chat',
  resume:    'work',
}

// scope 儲存在 sessionStorage（per-tab），不再用 cookie
export const SCOPE_SESSION_KEY = 'ai_gate_scope'

// 不受 scope 限制、任何系統都可存取的共用路徑
// /dashboard 不在此列：為 owner 專用總控台，非管理者會被導向 /apps
const SHARED_PREFIXES = ['/settings', '/team', '/api', '/callback', '/login', '/register', '/logout', '/privacy', '/work']

export function isSystemKey(s: string | undefined | null): s is SystemKey {
  return !!s && Object.prototype.hasOwnProperty.call(SYSTEMS, s)
}

export function isPathAllowedForScope(scope: SystemKey, pathname: string): boolean {
  if (pathname === '/') return true
  if (SHARED_PREFIXES.some(p => pathname === p || pathname.startsWith(p + '/'))) return true
  return SYSTEMS[scope].prefixes.some(p => pathname === p || pathname.startsWith(p + '/'))
}

// 反查某路徑屬於哪個系統（用於未登入時導向該系統的登入頁）
export function systemForPath(pathname: string): SystemKey | null {
  for (const def of SYSTEM_LIST) {
    if (def.prefixes.some(p => pathname === p || pathname.startsWith(p + '/'))) return def.key
  }
  return null
}
