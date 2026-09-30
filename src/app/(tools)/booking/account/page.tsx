import { redirect } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { createClient, getCachedUser } from '@/lib/supabase/server'
import { SettingsForm } from '@/components/settings/SettingsForm'
import { CompanyMembershipSection } from '@/components/settings/CompanyMembershipSection'
import CsBookingModeCard from './CsBookingModeCard'

// 訂房系統專用的帳號設定：套用訂房側欄，不含聊天側欄與行銷用的平台／品牌素材設定
export default async function BookingAccountPage() {
  const supabase = await createClient()
  const { data: { user } } = await getCachedUser()
  if (!user) {
    redirect('/login')
    return null
  }

  const t = await getTranslations('Settings')
  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single()
  const { data: creditBalance } = await supabase.rpc('get_credit_balance', { p_user_id: user.id })

  return (
    <div className="max-w-2xl mx-auto px-6 py-8 space-y-12">
      <div>
        <h1 className="text-2xl font-bold">{t('title')}</h1>
        <p className="text-muted-foreground text-sm mt-1">{t('subtitle')}</p>
      </div>
      <CsBookingModeCard />
      <SettingsForm profile={profile} creditBalance={creditBalance ?? 0} variant="basic" />

      <div>
        <div className="mb-6">
          <h2 className="text-lg font-bold">公司與團隊成員</h2>
          <p className="text-muted-foreground text-sm mt-1">
            管理所屬公司實體、成員名冊與協同邀請權限。
          </p>
        </div>
        <CompanyMembershipSection />
      </div>
    </div>
  )
}
