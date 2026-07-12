// 訂房推薦碼：唯一產生/取得邏輯，供 checkout 與 referral API 共用。
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SupabaseClient = any

// 避免易混淆字元（0/O、1/I）
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

function randomCode(len = 6): string {
  let s = ''
  for (let i = 0; i < len; i++) s += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]
  return s
}

/** 取得使用者的推薦碼，沒有就產生一組（含碰撞重試）。需用 service role client 呼叫。 */
export async function getOrCreateReferralCode(supabase: SupabaseClient, userId: string): Promise<string> {
  const { data } = await supabase
    .from('booking_subscriptions')
    .select('referral_code')
    .eq('user_id', userId)
    .maybeSingle()
  if (data?.referral_code) return data.referral_code

  for (let attempt = 0; attempt < 5; attempt++) {
    const code = randomCode()
    const { error } = await supabase
      .from('booking_subscriptions')
      .upsert({ user_id: userId, referral_code: code }, { onConflict: 'user_id' })
    if (!error) return code
    if (error.code !== '23505') throw new Error(error.message)
    // referral_code 撞碼，重新產生
  }
  throw new Error('無法產生推薦碼，請稍後再試')
}
