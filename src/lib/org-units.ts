// 公司單位（功能群）與其對應頁面。用於 /office 入口分群與存取判斷。
// 純常數，client/server 皆可 import。

// adminOnly：該頁權限尚未開放給單位員工（仍僅管理者）。各群的權限 PR 落地後拿掉此旗標。
export interface UnitPage { href: string; label: string; adminOnly?: boolean }
export interface UnitArea { key: string; label: string; pages: UnitPage[] }

// 各單位群（access 以此 key 記於 profiles.units）
export const UNIT_AREAS: UnitArea[] = [
  { key: 'hr', label: '人事', pages: [
    { href: '/hr', label: '人事管理' }, { href: '/personnel', label: '人員資料' },
  ] },
  { key: 'finance', label: '出納・總務・會計', pages: [
    { href: '/finance', label: '出納總務', adminOnly: true }, { href: '/store-expenses', label: '門市費用', adminOnly: true },
    { href: '/vendors', label: '廠商資料', adminOnly: true }, { href: '/units', label: '單位資料', adminOnly: true },
  ] },
  { key: 'rd', label: '研發', pages: [
    { href: '/rd', label: '配方中心', adminOnly: true }, { href: '/rd-recipes', label: '配方成本', adminOnly: true },
    { href: '/rd-ai', label: '研發討論AI', adminOnly: true }, { href: '/rd-logs', label: '研發日誌', adminOnly: true },
  ] },
  { key: 'store', label: '門市營運', pages: [
    { href: '/store-reports', label: '門市報表', adminOnly: true }, { href: '/store-inventory', label: '盤點・訂貨', adminOnly: true },
    { href: '/pos', label: '門市點單', adminOnly: true },
  ] },
  { key: 'affairs', label: '外務', pages: [
    { href: '/affairs', label: '外務・證照', adminOnly: true },
  ] },
]

// 共用（所有登入者都可見）
export const COMMON_PAGES: UnitPage[] = [
  { href: '/work', label: '任務' }, { href: '/meeting', label: '會議紀錄' },
]

export const UNIT_LABEL: Record<string, string> = Object.fromEntries(UNIT_AREAS.map(a => [a.key, a.label]))

// 是否可存取某單位群（管理者全開）
export function hasUnit(isAdmin: boolean, units: string[] | null | undefined, key: string): boolean {
  return isAdmin || (units ?? []).includes(key)
}
