import type { createAdminClient } from '@/lib/supabase/admin'
import { decryptSecret, encryptSecret } from '@/lib/crypto/secret'

type Admin = ReturnType<typeof createAdminClient>

export const MIN_INITIAL_PASSWORD = 8

/** 公司設定的員工初始密碼（未設定回傳 null） */
export async function getInitialPassword(admin: Admin, companyId: string): Promise<string | null> {
  const { data } = await admin.from('company_employee_defaults').select('initial_password').eq('company_id', companyId).maybeSingle()
  return data?.initial_password ? decryptSecret(data.initial_password) : null
}

export async function setInitialPassword(admin: Admin, companyId: string, password: string, userId: string) {
  return admin.from('company_employee_defaults').upsert({
    company_id: companyId, initial_password: encryptSecret(password), updated_by: userId, updated_at: new Date().toISOString(),
  }, { onConflict: 'company_id' })
}

/** 為 Email 直接建立帳號（免註冊、免驗證信）；建立後資料庫觸發器依員工名單綁定公司 */
export async function provisionAccounts(admin: Admin, emails: string[], password: string, byUserId: string) {
  const list = [...new Set(emails.map(e => e.toLowerCase().trim()).filter(Boolean))]
  const { data: profs } = list.length ? await admin.from('profiles').select('email').in('email', list) : { data: [] }
  const registered = new Set((profs ?? []).map(p => String(p.email).toLowerCase()))
  const created: string[] = [], failed: { email: string; error: string }[] = []
  for (const email of list.filter(e => !registered.has(e))) {
    const { error } = await admin.auth.admin.createUser({
      email, password, email_confirm: true,
      user_metadata: { full_name: email.split('@')[0], initial_password: true, provisioned_by: byUserId },
    })
    if (error) failed.push({ email, error: error.message }); else created.push(email)
  }
  return { created, failed, skipped: list.length - created.length - failed.length }
}
