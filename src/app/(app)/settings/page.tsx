import { redirect } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { createClient } from '@/lib/supabase/server'
import { SettingsForm } from '@/components/settings/SettingsForm'
import { CompanyDataForm } from '@/components/settings/CompanyDataForm'

export default async function SettingsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const t = await getTranslations('Settings')
  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single()

  return (
    <div className="h-full overflow-y-auto bg-slate-50/50 dark:bg-background">
      <div className="max-w-2xl mx-auto px-6 py-8 space-y-12">
        <div className="mb-8">
          <h1 className="text-2xl font-bold">{t('title')}</h1>
          <p className="text-muted-foreground text-sm mt-1">{t('subtitle')}</p>
        </div>
        <SettingsForm profile={profile} creditBalance={profile?.credit_balance ?? 0} />

        {/* Company Data Section */}
        <div>
          <div className="mb-6">
            <h2 className="text-lg font-bold">公司資料</h2>
            <p className="text-muted-foreground text-sm mt-1">
              管理品牌資料與素材，供行銷自動化模組使用。填寫後點擊「一鍵轉檔」生成 AI 快取。
            </p>
          </div>
          <CompanyDataForm />
        </div>
      </div>
    </div>
  )
}
