import type { SupabaseClient } from '@supabase/supabase-js'

/** 最近 100 筆社群矩陣紀錄，附帳號名稱與平台（RLS：只會讀到自己的） */
export async function fetchSocialLogs(supabase: SupabaseClient) {
  const { data } = await supabase
    .from('marketing_social_logs')
    .select('*, account:marketing_social_accounts(account_name, platform)')
    .order('created_at', { ascending: false })
    .limit(100)
  return (data ?? []).map(({ account, ...l }) => {
    const acc = (Array.isArray(account) ? account[0] : account) as { account_name?: string; platform?: string } | null
    return { ...l, account_name: acc?.account_name, platform: acc?.platform }
  })
}
