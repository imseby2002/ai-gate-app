// 各獨立系統的定義：每個系統有自己的登入/註冊入口，登入後 session 被限定在該系統。
// 切換系統需從另一系統的登入頁進入（會更新 scope cookie）。

export type SystemKey = 'chat' | 'booking' | 'cs' | 'marketing' | 'leads' | 'resume' | 'agent' | 'office'

export interface SystemDef {
  key: SystemKey
  label: string
  desc: string
  home: string
  prefixes: string[]
}

export const SYSTEMS: Record<SystemKey, SystemDef> = {
  chat:      { key: 'chat',      label: 'AI 對話',    desc: '多模型智慧對話、助理與圖片／影片生成', home: '/apps',           prefixes: ['/apps', '/chat', '/assistants', '/image-gen', '/video-gen', '/usage', '/roundtable'] },
  booking:   { key: 'booking',   label: '訂房系統',   desc: '房源、訂單、定價、線上訂房與通路同步', home: '/booking',        prefixes: ['/booking'] },
  cs:        { key: 'cs',        label: '客服系統',   desc: '多平台 AI 客服與知識庫', home: '/cs',             prefixes: ['/cs', '/marketing-auto'] },
  marketing: { key: 'marketing', label: '行銷中心', desc: '行銷內容生成與自動化流水線', home: '/marketing', prefixes: ['/marketing', '/marketing-auto', '/marketing-pipeline', '/prospect-call', '/mkt'] },
  leads:     { key: 'leads',     label: '開發信',     desc: '潛在客戶開發與外呼', home: '/prospect-call',  prefixes: ['/prospect-call'] },
  office:    { key: 'office',    label: '公司入口',   desc: '人事、出納總務、研發、門市、外務、稽核、任務等辦公系統', home: '/office', prefixes: ['/office', '/hr', '/personnel', '/finance', '/store-expenses', '/vendors', '/units', '/rd', '/rd-recipes', '/rd-lab', '/rd-ai', '/rd-logs', '/store', '/store-reports', '/store-inventory', '/store-bills', '/store-coach', '/repair', '/shift', '/pos', '/affairs', '/audit', '/audit-inspection', '/audit-ai', '/audit-logs', '/audit-platform', '/gm', '/meeting', '/work', '/roundtable', '/mkt', '/legal'] },
  resume:    { key: 'resume',    label: '職場助手',   desc: 'AI 全方位職場助理', home: '/resume',         prefixes: ['/resume'] },
  agent:     { key: 'agent',     label: 'AI Agent', desc: '全自動 AI 員工：自主研究、規劃、執行，重要動作交真人核准', home: '/agent', prefixes: ['/agent'] },
}

export const SYSTEMS_VI: Record<SystemKey, SystemDef> = {
  chat:      { key: 'chat',      label: 'AI Trò Chuyện',        desc: 'Hội thoại đa mô hình, trợ lý AI & tạo ảnh / video', home: '/apps',           prefixes: ['/apps', '/chat', '/assistants', '/image-gen', '/video-gen', '/usage', '/roundtable'] },
  booking:   { key: 'booking',   label: 'Hệ Thống Đặt Phòng',   desc: 'Quản lý phòng, đơn đặt, định giá & đồng bộ kênh OTA', home: '/booking',        prefixes: ['/booking'] },
  cs:        { key: 'cs',        label: 'Hệ Thống CSKH',        desc: 'Trợ lý CSKH AI đa kênh và cơ sở dữ liệu tri thức', home: '/cs',             prefixes: ['/cs', '/marketing-auto'] },
  marketing: { key: 'marketing', label: 'Trung Tâm Marketing',  desc: 'Tự động hóa tiếp thị, pipeline & sản xuất nội dung', home: '/marketing', prefixes: ['/marketing', '/marketing-auto', '/marketing-pipeline', '/prospect-call', '/mkt'] },
  leads:     { key: 'leads',     label: 'Khai Thác Khách Hàng', desc: 'Tìm kiếm khách hàng tiềm năng và tự động gọi điện', home: '/prospect-call',  prefixes: ['/prospect-call'] },
  office:    { key: 'office',    label: 'Cổng Công Ty',         desc: 'Hệ thống văn phòng: Nhân sự, Thủ quỹ, R&D, Chi nhánh, Đối ngoại, Kiểm toán, Nhiệm vụ', home: '/office', prefixes: ['/office', '/hr', '/personnel', '/finance', '/store-expenses', '/vendors', '/units', '/rd', '/rd-recipes', '/rd-lab', '/rd-ai', '/rd-logs', '/store', '/store-reports', '/store-inventory', '/store-bills', '/store-coach', '/repair', '/shift', '/pos', '/affairs', '/audit', '/audit-inspection', '/audit-ai', '/audit-logs', '/audit-platform', '/gm', '/meeting', '/work', '/roundtable', '/mkt', '/legal'] },
  resume:    { key: 'resume',    label: 'Trợ Lý Nghề Nghiệp',   desc: 'Trợ lý AI toàn diện cho công việc & nghề nghiệp', home: '/resume',         prefixes: ['/resume'] },
  agent:     { key: 'agent',     label: 'AI Agent',             desc: 'Nhân viên AI tự động: tự nghiên cứu, lập kế hoạch, thực thi công việc', home: '/agent', prefixes: ['/agent'] },
}

export const SYSTEMS_EN: Record<SystemKey, SystemDef> = {
  chat:      { key: 'chat',      label: 'AI Chat',             desc: 'Multi-model AI conversations, assistants & media generation', home: '/apps',           prefixes: ['/apps', '/chat', '/assistants', '/image-gen', '/video-gen', '/usage', '/roundtable'] },
  booking:   { key: 'booking',   label: 'Booking System',      desc: 'Properties, reservations, pricing, and OTA sync', home: '/booking',        prefixes: ['/booking'] },
  cs:        { key: 'cs',        label: 'Customer Service',    desc: 'Omnichannel AI customer support & knowledge base', home: '/cs',             prefixes: ['/cs', '/marketing-auto'] },
  marketing: { key: 'marketing', label: 'Marketing Center',   desc: 'Marketing content generation & automated pipelines', home: '/marketing', prefixes: ['/marketing', '/marketing-auto', '/marketing-pipeline', '/prospect-call', '/mkt'] },
  leads:     { key: 'leads',     label: 'Lead Generation',     desc: 'Prospect discovery and outreach calls', home: '/prospect-call',  prefixes: ['/prospect-call'] },
  office:    { key: 'office',    label: 'Company Portal',      desc: 'Office systems: HR, Finance, R&D, Store Operations, Legal, Audit, Tasks', home: '/office', prefixes: ['/office', '/hr', '/personnel', '/finance', '/store-expenses', '/vendors', '/units', '/rd', '/rd-recipes', '/rd-lab', '/rd-ai', '/rd-logs', '/store', '/store-reports', '/store-inventory', '/store-bills', '/store-coach', '/repair', '/shift', '/pos', '/affairs', '/audit', '/audit-inspection', '/audit-ai', '/audit-logs', '/audit-platform', '/gm', '/meeting', '/work', '/roundtable', '/mkt', '/legal'] },
  resume:    { key: 'resume',    label: 'Career Assistant',    desc: 'All-in-one AI career & workplace assistant', home: '/resume',         prefixes: ['/resume'] },
  agent:     { key: 'agent',     label: 'AI Agent',            desc: 'Autonomous AI worker: research, plan, and execute with human approval', home: '/agent', prefixes: ['/agent'] },
}

export function getLocalizedSystems(locale?: string): Record<SystemKey, SystemDef> {
  if (locale === 'vi') return SYSTEMS_VI
  if (locale === 'en') return SYSTEMS_EN
  return SYSTEMS
}

export function getLocalizedSystemDef(system: SystemKey, locale?: string): SystemDef {
  const sysMap = getLocalizedSystems(locale)
  return sysMap[system] || SYSTEMS[system]
}

export const SYSTEM_LIST: SystemDef[] = Object.values(SYSTEMS)

// 子域名 → 所屬系統（用於未登入登入導向與 OAuth callback 推斷）
// 不靠 systemForPath：/marketing-auto 同時屬 cs 與 marketing，路徑反查有歧義
export const SUBDOMAIN_SYSTEM: Record<string, SystemKey> = {
  cs:        'cs',
  booking:   'booking',
  marketing: 'marketing',
  chat:      'chat',
  work:      'office',
  office:    'office',
  agent:     'agent',
}

// 系統 → 子域名（OAuth callback 後讓功能頁落回對應子域，避免停在 www）
export const SYSTEM_SUBDOMAIN: Partial<Record<SystemKey, string>> = {
  cs:        'cs',
  booking:   'booking',
  marketing: 'marketing',
  chat:      'chat',
  resume:    'work',
  office:    'office',
  agent:     'agent',
}

// scope 儲存在 sessionStorage（per-tab），不再用 cookie
export const SCOPE_SESSION_KEY = 'ai_gate_scope'

// 不受 scope 限制、任何系統都可存取的共用路徑
// /dashboard 不在此列：為 owner 專用總控台，非管理者會被導向 /apps
const SHARED_PREFIXES = ['/settings', '/team', '/api', '/callback', '/login', '/register', '/logout', '/privacy', '/work', '/office', '/roundtable', '/mkt', '/legal', '/esim', '/feedback', '/credits', '/company']

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
