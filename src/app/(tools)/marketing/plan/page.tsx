import { redirect } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { createClient } from '@/lib/supabase/server'
import { MarketingPlanUpgrade } from '@/components/marketing/MarketingPlanUpgrade'

export default async function MarketingPlanPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const t = await getTranslations('Marketing')

  return (
    <div className="h-full overflow-y-auto bg-slate-50/50 dark:bg-background">
      <div className="max-w-5xl mx-auto px-6 py-8">
        <h1 className="text-2xl font-bold mb-1">{t('planPage.title')}</h1>
        <p className="text-sm text-muted-foreground mb-6">{t('planPage.desc')}</p>
        <MarketingPlanUpgrade />
      </div>
    </div>
  )
}
