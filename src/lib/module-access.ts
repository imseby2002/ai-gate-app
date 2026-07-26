import type { SupabaseClient } from '@supabase/supabase-js'

// API route 專用的模組存取檢查（取代未被使用的 module-guard.ts）。
//
// middleware.ts 刻意不驗證 /api/* 路徑（見該檔案註解：一個頁面可能同時夾帶
// 幾十個 API 請求，若每支都在 middleware 重新呼叫 auth.getUser() 會同時搶用
// 同一組一次性 refresh token，觸發 Supabase rate limit）。
// 因此每個模組的 API route 必須自己呼叫此函式做模組層級的檢查，
// 而不是只檢查登入與否——否則 enabled_modules 這道「付費牆」只在頁面存在，
// 直接打 API 就能繞過。
//
// 刻意重用呼叫端已建立的 supabase client 與已取得的 userId，不重新呼叫
// auth.getUser()，只多一次輕量的 profiles 查詢。
export async function hasModuleAccess(
  supabase: SupabaseClient,
  userId: string,
  moduleId: string,
): Promise<boolean> {
  const { data: profile } = await supabase
    .from('profiles')
    .select('user_type, enabled_modules')
    .eq('id', userId)
    .single()
  if (!profile) return false
  if (profile.user_type === 'admin') return true
  const enabled: string[] = profile.enabled_modules ?? ['chat', 'marketing', 'cs', 'leads', 'resume', 'booking']
  return enabled.includes(moduleId)
}
