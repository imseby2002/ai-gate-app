import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getTranslations } from 'next-intl/server'
import { createClient } from '@/lib/supabase/server'
import { MessageSquare, Bot, BarChart3, TrendingUp, Lock } from 'lucide-react'
import { formatCost, formatTokens } from '@/lib/utils/format'
import { MODULES } from '@/lib/modules'

export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ blocked?: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const t = await getTranslations('Dashboard')
  const sp = await searchParams

  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single()

  const enabledModules: string[] = profile?.enabled_modules ?? MODULES.map(m => m.id)
  const isAdmin = profile?.user_type === 'admin'

  // Usage stats last 7 days
  const { data: usageData } = await supabase
    .from('usage_daily')
    .select('model_id, message_count, total_cost_usd, input_tokens, output_tokens')
    .eq('user_id', user.id)
    .gte('date', new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0])

  const totalCost     = usageData?.reduce((sum, r) => sum + (r.total_cost_usd ?? 0), 0) ?? 0
  const totalMessages = usageData?.reduce((sum, r) => sum + (r.message_count ?? 0), 0) ?? 0
  const totalTokens   = usageData?.reduce((sum, r) => sum + (r.input_tokens ?? 0) + (r.output_tokens ?? 0), 0) ?? 0

  const { count: assistantCount } = await supabase
    .from('assistants')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user.id)

  return (
    <div className="h-full overflow-y-auto px-6 py-6 space-y-6">
      {/* Welcome */}
      <div>
        <h1 className="text-2xl font-bold">
          {t('welcome', { name: profile?.full_name ?? profile?.email })}
        </h1>
        <p className="text-gray-500 text-sm mt-1">{t('subtitle')}</p>
      </div>

      {/* Blocked notice */}
      {sp.blocked && (
        <div className="flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-800">
          <Lock className="h-4 w-4 shrink-0" />
          此功能模組尚未開放，請聯繫管理員。
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { label: t('weeklyMessages'), value: totalMessages.toString(), icon: MessageSquare },
          { label: t('weeklyTokens'),   value: formatTokens(totalTokens), icon: TrendingUp },
          { label: t('weeklyCost'),     value: formatCost(totalCost),     icon: BarChart3 },
        ].map(stat => (
          <div key={stat.label} className="bg-white rounded-2xl border p-5 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm text-gray-500">{stat.label}</span>
              <stat.icon className="h-4 w-4 text-gray-400" />
            </div>
            <div className="text-2xl font-bold">{stat.value}</div>
          </div>
        ))}
      </div>

      {/* Module tiles */}
      <div>
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">功能模組</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {MODULES.map(mod => {
            const accessible = isAdmin || enabledModules.includes(mod.id)
            return (
              <div key={mod.id} className={`relative rounded-2xl border overflow-hidden shadow-sm transition-all ${accessible ? 'hover:shadow-md hover:-translate-y-0.5' : 'opacity-50'}`}>
                <div className={`h-1.5 bg-gradient-to-r ${mod.color}`} />
                <div className="p-5">
                  <div className="flex items-start justify-between mb-3">
                    <span className="text-3xl">{mod.emoji}</span>
                    {!accessible && <Lock className="h-4 w-4 text-gray-400 mt-1" />}
                  </div>
                  <div className="font-semibold text-gray-900">{mod.label}</div>
                  <div className="text-xs text-gray-500 mt-1 mb-4">{mod.desc}</div>
                  {accessible ? (
                    <Link
                      href={mod.href}
                      className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg text-white transition-opacity hover:opacity-90"
                      style={{ background: `var(--primary)` }}
                    >
                      進入
                    </Link>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg bg-gray-100 text-gray-400">
                      未開放
                    </span>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* My Assistants */}
      {(isAdmin || enabledModules.includes('chat')) && (
        <div className="bg-white rounded-2xl border p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Bot className="h-5 w-5 text-gray-400" />
              <h2 className="font-semibold">{t('myAssistants')}</h2>
              <span className="text-sm text-gray-500">({assistantCount ?? 0})</span>
            </div>
            <Link href="/assistants" className="text-sm font-medium" style={{ color: 'var(--primary)' }}>
              {t('manage')}
            </Link>
          </div>
          {(assistantCount ?? 0) === 0 ? (
            <div className="text-center py-8 text-gray-400">
              <Bot className="h-10 w-10 mx-auto mb-3 opacity-30" />
              <p className="text-sm">{t('noAssistants')}</p>
              <Link
                href="/assistants/new"
                className="inline-block mt-3 text-sm font-medium px-4 py-2 rounded-lg text-white"
                style={{ background: 'var(--primary)' }}
              >
                {t('createFirst')}
              </Link>
            </div>
          ) : (
            <Link href="/assistants" className="text-sm text-gray-500 hover:text-gray-800">
              {t('viewAll')}
            </Link>
          )}
        </div>
      )}
    </div>
  )
}
