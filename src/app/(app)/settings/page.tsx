import { redirect } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { createClient } from '@/lib/supabase/server'
import { SettingsForm } from '@/components/settings/SettingsForm'
import { CompanyDataForm } from '@/components/settings/CompanyDataForm'
import { CompanyMembershipSection } from '@/components/settings/CompanyMembershipSection'

export default async function SettingsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    redirect('/login')
    return null
  }

  const t = await getTranslations('Settings')
  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single()
  // 餘額真相來源是 credit_transactions 加總（get_credit_balance RPC）。
  // profiles 沒有 credit_balance 欄位，直接讀 profile.credit_balance 永遠是 0。
  const { data: creditBalance } = await supabase.rpc('get_credit_balance', { p_user_id: user.id })

  return (
    <div className="h-full overflow-y-auto bg-slate-50/50 dark:bg-background">
      <div className="max-w-2xl mx-auto px-6 py-8 space-y-12">
        <div className="mb-8">
          <h1 className="text-2xl font-bold">{t('title')}</h1>
          <p className="text-muted-foreground text-sm mt-1">{t('subtitle')}</p>
        </div>
        <SettingsForm profile={profile} creditBalance={creditBalance ?? 0} />

        {/* Company & Team Membership Section */}
        <div>
          <div className="mb-6">
            <h2 className="text-lg font-bold">公司與團隊成員</h2>
            <p className="text-muted-foreground text-sm mt-1">
              管理所屬公司實體、成員名冊與協同邀請權限。
            </p>
          </div>
          <CompanyMembershipSection />
        </div>

        {/* Company Data Section */}
        <div>
          <div className="mb-6">
            <h2 className="text-lg font-bold">品牌與行銷資料庫</h2>
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
