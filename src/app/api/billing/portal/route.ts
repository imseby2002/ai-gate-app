import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// 回傳用戶的點數交易紀錄（取代 Stripe billing portal）
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: transactions } = await supabase
    .from('credit_transactions')
    .select('id, amount_usd, type, description, balance_after, created_at')
    .eq('user_id', user.id)
    .not('description', 'like', 'PENDING:%')
    .order('created_at', { ascending: false })
    .limit(50)

  // 餘額真相來源是 credit_transactions 加總（get_credit_balance RPC）。
  // profiles 沒有 credit_balance 欄位，直接讀會永遠是 0。
  const { data: balance } = await supabase.rpc('get_credit_balance', { p_user_id: user.id })

  return NextResponse.json({
    balance: balance ?? 0,
    transactions: transactions ?? [],
  })
}
