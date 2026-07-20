import { redirect } from 'next/navigation'
import { Zap } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { CreditWallet, type CreditTx } from '@/components/billing/CreditWallet'
import { CreditsBack } from './CreditsBack'

export const dynamic = 'force-dynamic'

// 點數錢包：全系統共用的儲值頁。刻意放在 (app) 群組外，不套用任何模組的側邊欄——
// 從任何模組點「儲值點數」都進同一頁，返回時回到進來的那個模組（見 CreditsBack）。
export default async function CreditsPage({
  searchParams,
}: {
  searchParams: Promise<{ payment?: string; from?: string }>
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
    <div className="min-h-[100dvh] bg-slate-50/50 dark:bg-background">
      {/* 極簡頂欄：只有 logo 與返回，不帶任何模組選單 */}
      <header className="border-b bg-card px-4 sm:px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Zap className="h-5 w-5 text-primary" />
          <span className="font-bold">AI GATE</span>
        </div>
        <CreditsBack from={sp.from} />
      </header>

      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8">
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
