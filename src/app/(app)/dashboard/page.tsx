import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getTranslations } from 'next-intl/server'
import { createClient } from '@/lib/supabase/server'
import { MessageSquare, Bot, BarChart3, Zap, ArrowRight, TrendingUp } from 'lucide-react'
import { formatCost, formatTokens } from '@/lib/utils/format'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const t = await getTranslations('Dashboard')

  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single()

  // Usage stats last 7 days
  const { data: usageData } = await supabase
    .from('usage_daily')
    .select('model_id, message_count, total_cost_usd, input_tokens, output_tokens')
    .eq('user_id', user.id)
    .gte('date', new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0])

  const totalCost = usageData?.reduce((sum, r) => sum + (r.total_cost_usd ?? 0), 0) ?? 0
  const totalMessages = usageData?.reduce((sum, r) => sum + (r.message_count ?? 0), 0) ?? 0
  const totalTokens = usageData?.reduce((sum, r) => sum + (r.input_tokens ?? 0) + (r.output_tokens ?? 0), 0) ?? 0

  // Assistant count
  const { count: assistantCount } = await supabase
    .from('assistants')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user.id)

  const MODEL_ROUTE_MAP = [
    { key: 'daily',     label: t('routes.daily'),    emoji: '💬', href: '/chat' },
    { key: 'finance',   label: t('routes.finance'),  emoji: '📊', href: '/chat' },
    { key: 'creative',  label: t('routes.creative'), emoji: '🎨', href: '/chat' },
    { key: 'analysis',  label: t('routes.analysis'), emoji: '🔬', href: '/chat' },
    { key: 'legal',     label: t('routes.legal'),    emoji: '⚖️', href: '/chat' },
    { key: 'vision',    label: t('routes.vision'),   emoji: '🖼️', href: '/chat' },
    { key: 'image-gen', label: t('routes.imageGen'), emoji: '✨', href: '/image-gen' },
    { key: 'video-gen', label: t('routes.videoGen'), emoji: '🎬', href: '/video-gen' },
  ]

  return (
    <div className="h-full overflow-y-auto px-6 py-6 space-y-6">
      {/* Welcome */}
      <div>
        <h1 className="text-2xl font-bold">
          {t('welcome', { name: profile?.full_name ?? profile?.email })}
        </h1>
        <p className="text-gray-500 text-sm mt-1">{t('subtitle')}</p>
      </div>

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

      {/* Quick Actions */}
      <div>
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">{t('quickStart')}</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {MODEL_ROUTE_MAP.map((item) => (
            <Link
              key={item.key}
              href={item.href}
              className="bg-white rounded-xl border p-4 shadow-sm hover:shadow-md transition-all hover:-translate-y-0.5 group"
            >
              <div className="text-2xl mb-2">{item.emoji}</div>
              <div className="text-sm font-medium">{item.label}</div>
              <ArrowRight className="h-3.5 w-3.5 text-gray-400 mt-2 group-hover:translate-x-1 transition-transform" />
            </Link>
          ))}
        </div>
      </div>

      {/* My Assistants Preview */}
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
    </div>
  )
}
