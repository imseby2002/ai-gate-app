import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { MarketingPlanUpgrade } from '@/components/marketing/MarketingPlanUpgrade'

export default async function MarketingPlanPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  return (
    <div className="h-full overflow-y-auto bg-slate-50/50 dark:bg-background">
      <div className="max-w-5xl mx-auto px-6 py-8">
        <h1 className="text-2xl font-bold mb-1">訂閱方案</h1>
        <p className="text-sm text-muted-foreground mb-6">依功能需求選擇適合的方案，隨時可升級；生成成本以儲值點數另計</p>
        <MarketingPlanUpgrade />
      </div>
    </div>
  )
}
