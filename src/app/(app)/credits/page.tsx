import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { CreditWallet, type CreditTx } from '@/components/billing/CreditWallet'

export const dynamic = 'force-dynamic'

// 點數錢包：餘額、儲值方案、交易紀錄的集中頁（點數為全系統共用貨幣，
// 從 Settings 拉出來成為一等公民，各系統的「儲值點數」入口都導向這裡）。
export default async function CreditsPage({
  searchParams,
}: {
  searchParams: Promise<{ payment?: string }>
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const sp = await searchParams

  const { data: balance } = await supabase.rpc('get_credit_balance', { p_user_id: user.id })
  const { data: transactions } = await supabase
    .from('credit_transactions')
    .select('id, amount_usd, type, description, created_at')
    .eq('user_id', user.id)
    .not('description', 'like', 'PENDING:%')
    .order('created_at', { ascending: false })
    .limit(50)

  return (
    <div className="h-full overflow-y-auto bg-slate-50/50 dark:bg-background">
      <div className="max-w-2xl mx-auto px-6 py-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold">點數錢包</h1>
          <p className="text-muted-foreground text-sm mt-1">
            點數為全系統共用，聊天、AI 工具、客服 Claude 升級等功能都以點數計費。
          </p>
        </div>
        <CreditWallet
          balance={balance ?? 0}
          transactions={(transactions ?? []) as CreditTx[]}
          justPaid={sp.payment === 'done'}
        />
      </div>
    </div>
  )
}
