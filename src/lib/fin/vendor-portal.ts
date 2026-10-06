// 廠商填表好記網址：<公司子網域>/v/<代號>，由公司設定初始密碼，廠商可自行變更。
// 舊 /vendor/<token> 連結：設好新網址與密碼的廠商，於 LEGACY_PAYSLIP_CUTOFF 後須以密碼登入才能使用。
import { NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { companySlugForOwner } from '@/lib/company/fromHost'
import { LEGACY_PAYSLIP_CUTOFF, LOCK_MINUTES, MAX_FAILS, checkPin, verifySession } from '@/lib/hr/portal'

export const VENDOR_COOKIE = 'vendor_portal'
export const VENDOR_SLUG_PATTERN = /^[a-z0-9]([a-z0-9-]{0,38}[a-z0-9])?$/

export async function vendorPortalUrl(ownerId: string, linkSlug: string | null): Promise<string | null> {
  if (!linkSlug) return null
  const slug = await companySlugForOwner(ownerId)
  return slug ? `https://${slug}.im-tourist.com/v/${linkSlug}` : null
}

/** 舊 token 連結是否仍可使用：過渡期內可用；之後若已設新網址＋密碼，需帶本廠商的登入工作階段 */
export function vendorTokenAllowed(req: NextRequest, v: { id: string; link_slug?: string | null; pin_hash?: string | null }): boolean {
  if (!v.link_slug || !v.pin_hash) return true
  if (Date.now() < LEGACY_PAYSLIP_CUTOFF.getTime()) return true
  return verifySession(req.cookies.get(VENDOR_COOKIE)?.value, 'vendor') === v.id
}

type LoginResult = { ok: true; vendorId: string; fillToken: string } | { ok: false; status: number; error: string }

export async function vendorLogin(ownerId: string, linkSlug: string, pin: string): Promise<LoginResult> {
  const admin = createAdminClient()
  const { data: v } = await admin.from('fin_vendors')
    .select('id, fill_token, active, pin_hash, pin_failed, pin_locked_until')
    .eq('owner_id', ownerId).eq('link_slug', linkSlug).maybeSingle()
  if (!v || !v.active) return { ok: false, status: 404, error: '連結無效或已停用' }
  if (!v.pin_hash) return { ok: false, status: 403, error: '尚未設定密碼，請聯絡公司' }
  const now = Date.now()
  if (v.pin_locked_until && new Date(v.pin_locked_until).getTime() > now) {
    return { ok: false, status: 429, error: `錯誤太多次，請 ${LOCK_MINUTES} 分鐘後再試` }
  }
  if (checkPin(pin.trim(), v.pin_hash)) {
    await admin.from('fin_vendors').update({ pin_failed: 0, pin_locked_until: null }).eq('id', v.id)
    return { ok: true, vendorId: v.id, fillToken: v.fill_token }
  }
  const fails = (v.pin_failed ?? 0) + 1
  await admin.from('fin_vendors').update({
    pin_failed: fails >= MAX_FAILS ? 0 : fails,
    pin_locked_until: fails >= MAX_FAILS ? new Date(now + LOCK_MINUTES * 60_000).toISOString() : null,
  }).eq('id', v.id)
  return { ok: false, status: 401, error: '密碼錯誤' }
}
