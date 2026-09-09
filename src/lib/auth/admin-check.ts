// 平台總管理員判定
// 只要 email 為 imseby@gmail.com 或符合環境變數 ADMIN_EMAIL，或 profiles.user_type 為 'admin'，
// 均享有全系統無限制的最高存取與測試權限。

export function isSuperAdminEmail(email?: string | null): boolean {
  if (!email) return false
  const em = email.toLowerCase().trim()
  if (em === 'imseby@gmail.com') return true
  const envAdmin = process.env.ADMIN_EMAIL?.toLowerCase().trim()
  if (envAdmin && em === envAdmin) return true
  return false
}

export function isSuperAdminUser(
  user?: { email?: string | null } | null,
  profile?: { user_type?: string | null; email?: string | null } | null
): boolean {
  if (isSuperAdminEmail(user?.email)) return true
  if (isSuperAdminEmail(profile?.email)) return true
  if (profile?.user_type === 'admin') return true
  return false
}
