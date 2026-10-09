import { redirect } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { createClient, getCachedUser } from '@/lib/supabase/server'
import { SettingsForm } from '@/components/settings/SettingsForm'
import Link from 'next/link'
import { Building2, ArrowRight, MessageCircle } from 'lucide-react'
import { CompanyMembershipSection } from '@/components/settings/CompanyMembershipSection'

export default async function SettingsPage() {
  const supabase = await createClient()
  const { data: { user } } = await getCachedUser()
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
    <div className="min-h-full bg-slate-50/50 dark:bg-background">
      <div className="max-w-2xl mx-auto px-6 py-8 space-y-12">
        <div className="mb-8">
          <h1 className="text-2xl font-bold">{t('title')}</h1>
          <p className="text-muted-foreground text-sm mt-1">{t('subtitle')}</p>
        </div>
        <SettingsForm profile={profile} creditBalance={creditBalance ?? 0} />

        {/* Company & Team Membership Section */}
        <div>
          <div className="mb-6">
            <h2 className="text-lg font-bold">{t('page.companyTitle')}</h2>
            <p className="text-muted-foreground text-sm mt-1">
              {t('page.companyDesc')}
            </p>
          </div>
          <CompanyMembershipSection />
        </div>

        {/* Company Data — 公司資料統一在行銷中心「公司資料」編輯 */}
        <Link href="/marketing/brand"
          className="flex items-center gap-4 rounded-2xl border p-5 hover:bg-muted/50 transition-colors">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
            <Building2 className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-lg font-bold">{t('page.dataTitle')}</h2>
            <p className="text-muted-foreground text-sm mt-0.5">
              {t('page.dataDesc')}
            </p>
          </div>
          <ArrowRight className="h-5 w-5 text-muted-foreground shrink-0" />
        </Link>

        {/* 官方帳號（Zalo OA / LINE / WhatsApp…）公司統一管理 */}
        <Link href="/company/channels"
          className="flex items-center gap-4 rounded-2xl border p-5 hover:bg-muted/50 transition-colors">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
            <MessageCircle className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-lg font-bold">{t('page.channelsTitle')}</h2>
            <p className="text-muted-foreground text-sm mt-0.5">
              {t('page.channelsDesc')}
            </p>
          </div>
          <ArrowRight className="h-5 w-5 text-muted-foreground shrink-0" />
        </Link>
      </div>
    </div>
  )
}
