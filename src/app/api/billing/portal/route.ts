import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const runtime = 'edge'

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

  const { data: profile } = await supabase
    .from('profiles')
    .select('credit_balance')
    .eq('id', user.id)
    .single()

  return NextResponse.json({
    balance: profile?.credit_balance ?? 0,
    transactions: transactions ?? [],
  })
}
