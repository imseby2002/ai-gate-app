// 員工專區（<公司子網域>/e/<打卡編號>）：生日或自設密碼登入、簽章 cookie 工作階段、舊薪資條連結過渡期
import { createHmac, randomBytes, scryptSync, timingSafeEqual } from 'crypto'
import { createAdminClient } from '@/lib/supabase/admin'
import { companySlugForOwner } from '@/lib/company/fromHost'

export const PORTAL_COOKIE = 'emp_portal'
const SESSION_HOURS = 12
export const MAX_FAILS = 5
export const LOCK_MINUTES = 15

/** 舊 /payslip/<token>、/vendor/<token> 連結的停用日（新連結上線日＋30 天） */
export const LEGACY_PAYSLIP_CUTOFF = new Date('2026-11-06T00:00:00+07:00')

function secret(): string {
  const s = process.env.EMPLOYEE_PORTAL_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!s) throw new Error('EMPLOYEE_PORTAL_SECRET 未設定')
  return s
}

/** 簽章工作階段；kind 區分員工專區（emp）與廠商填表（vendor），兩者不可互用 */
export function signSession(id: string, kind: 'emp' | 'vendor' = 'emp'): string {
  const body = Buffer.from(JSON.stringify({ eid: id, kind, exp: Date.now() + SESSION_HOURS * 3600_000 })).toString('base64url')
  const sig = createHmac('sha256', secret()).update(body).digest('base64url')
  return `${body}.${sig}`
}

export function verifySession(token: string | undefined, kind: 'emp' | 'vendor' = 'emp'): string | null {
  if (!token) return null
  const [body, sig] = token.split('.')
  if (!body || !sig) return null
  const expect = createHmac('sha256', secret()).update(body).digest('base64url')
  if (sig.length !== expect.length || !timingSafeEqual(Buffer.from(sig), Buffer.from(expect))) return null
  try {
    const p = JSON.parse(Buffer.from(body, 'base64url').toString())
    return typeof p.eid === 'string' && (p.kind ?? 'emp') === kind && p.exp > Date.now() ? p.eid : null
  } catch {
    return null
  }
}

export function hashPin(pin: string): string {
  const salt = randomBytes(16).toString('hex')
  return `${salt}:${scryptSync(pin, salt, 32).toString('hex')}`
}

export function checkPin(pin: string, stored: string): boolean {
  const [salt, hash] = stored.split(':')
  if (!salt || !hash) return false
  const got = scryptSync(pin, salt, 32)
  const want = Buffer.from(hash, 'hex')
  return got.length === want.length && timingSafeEqual(got, want)
}

/** 生日 YYYY-MM-DD → 員工輸入的 DDMMYYYY（只比對數字） */
function birthdayDigits(birthday: string | null): string | null {
  if (!birthday) return null
  const [y, m, d] = birthday.slice(0, 10).split('-')
  return y && m && d ? `${d}${m}${y}` : null
}

export async function portalUrlForEmployee(ownerId: string, attendanceNo: string | null): Promise<string | null> {
  if (!attendanceNo) return null
  const slug = await companySlugForOwner(ownerId)
  return slug ? `https://${slug}.im-tourist.com/e/${encodeURIComponent(attendanceNo)}` : null
}

type LoginResult =
  | { ok: true; employeeId: string; mustSetPin: boolean }
  | { ok: false; status: number; error: string }

/**
 * 以打卡編號＋（自設密碼或生日 DDMMYYYY）登入。只看在職員工；打卡編號重複時以密碼／生日區分。
 * 已設密碼的員工不再接受生日登入。連續錯誤 5 次鎖 15 分鐘。
 */
export async function portalLogin(ownerId: string, attendanceNo: string, secretInput: string): Promise<LoginResult> {
  const admin = createAdminClient()
  const { data: emps } = await admin.from('hr_employees')
    .select('id, birthday').eq('owner_id', ownerId).eq('attendance_no', attendanceNo).eq('status', 'active')
  if (!emps?.length) return { ok: false, status: 404, error: 'Không tìm thấy nhân viên / 查無此員工' }

  const ids = emps.map(e => e.id as string)
  const { data: portals } = await admin.from('hr_employee_portal').select('*').in('employee_id', ids)
  const pmap = new Map((portals ?? []).map(p => [p.employee_id as string, p]))

  const now = Date.now()
  if ([...pmap.values()].some(p => p.locked_until && new Date(p.locked_until).getTime() > now)) {
    return { ok: false, status: 429, error: `Sai quá nhiều lần, thử lại sau ${LOCK_MINUTES} phút / 錯誤太多次，請 ${LOCK_MINUTES} 分鐘後再試` }
  }

  const input = secretInput.trim()
  const digits = input.replace(/\D/g, '')
  let matched: { id: string; hasPin: boolean } | null = null
  let missingBirthday = false
  for (const e of emps) {
    const p = pmap.get(e.id)
    if (p?.pin_hash) {
      if (checkPin(input, p.pin_hash)) { matched = { id: e.id, hasPin: true }; break }
    } else {
      const bd = birthdayDigits(e.birthday)
      if (!bd) { missingBirthday = true; continue }
      if (digits === bd) { matched = { id: e.id, hasPin: false }; break }
    }
  }

  if (matched) {
    await admin.from('hr_employee_portal').upsert({ employee_id: matched.id, failed_count: 0, locked_until: null, updated_at: new Date().toISOString() })
    return { ok: true, employeeId: matched.id, mustSetPin: !matched.hasPin }
  }

  for (const id of ids) {
    const fails = (pmap.get(id)?.failed_count ?? 0) + 1
    await admin.from('hr_employee_portal').upsert({
      employee_id: id,
      failed_count: fails >= MAX_FAILS ? 0 : fails,
      locked_until: fails >= MAX_FAILS ? new Date(now + LOCK_MINUTES * 60_000).toISOString() : null,
      updated_at: new Date().toISOString(),
    })
  }
  if (missingBirthday && emps.length === 1) {
    return { ok: false, status: 403, error: 'Chưa có ngày sinh, vui lòng liên hệ quản lý / 尚未登記生日，請聯絡管理者' }
  }
  return { ok: false, status: 401, error: 'Sai ngày sinh hoặc mật khẩu / 生日或密碼錯誤' }
}
