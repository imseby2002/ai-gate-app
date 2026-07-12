'use client'

import Link from 'next/link'
import { InstallInboxButton } from './inbox/InstallInboxButton'
import { useTranslations } from 'next-intl'
import {
  MessageSquare, Ticket, Wifi, WifiOff, Settings, FlaskConical,
  Inbox, Database, ArrowRight, RefreshCw, CheckCircle2, Zap,
  BarChart3, ChevronRight, Users, UserPlus, Sparkles, Circle,
} from 'lucide-react'

const INDUSTRY_IDS = ['homestay', 'ecommerce', 'restaurant', 'clinic', 'beauty', 'education'] as const
type IndustryId = typeof INDUSTRY_IDS[number]

const INDUSTRY_STYLES: Record<IndustryId, { emoji: string; gradient: string }> = {
  homestay:  { emoji: '🏡', gradient: 'from-teal-500 to-emerald-600' },
  ecommerce: { emoji: '🛍️', gradient: 'from-orange-500 to-amber-600' },
  restaurant:{ emoji: '🍽️', gradient: 'from-red-500 to-rose-600' },
  clinic:    { emoji: '🏥', gradient: 'from-blue-500 to-indigo-600' },
  beauty:    { emoji: '💆', gradient: 'from-pink-500 to-rose-600' },
  education: { emoji: '📚', gradient: 'from-violet-500 to-purple-600' },
}

const PLATFORM_LABELS: Record<string, { name: string; emoji: string }> = {
  line:      { name: 'LINE OA', emoji: '💬' },
  whatsapp:  { name: 'WhatsApp', emoji: '📱' },
  telegram:  { name: 'Telegram', emoji: '✈️' },
  instagram: { name: 'Instagram', emoji: '📸' },
  zalo:      { name: 'Zalo', emoji: '🔵' },
  test:      { name: 'Test', emoji: '🧪' },
}

interface Props {
  industry: string
  todayMessages: number
  openTickets: number
  connectedPlatforms: string[]
  hasMessages: boolean
}

export function CsDashboard({ industry, todayMessages, openTickets, connectedPlatforms, hasMessages }: Props) {
  const t = useTranslations('CsDashboard')
  const id = (INDUSTRY_IDS.includes(industry as IndustryId) ? industry : 'homestay') as IndustryId
  const style = INDUSTRY_STYLES[id]
  const csUrl = `/marketing-auto?module=cs&industry=${industry}`

  // 站內免費試用引導：綁定頻道 + 收到第一則顧客訊息，代表已活化成功，checklist 就不再顯示
  const hasConnectedChannel = connectedPlatforms.length > 0
  const onboardingDone = hasConnectedChannel && hasMessages
  const onboardingSteps = [
    { label: '選擇產業並建立客服設定', done: true, href: csUrl },
    { label: '綁定第一個客服頻道（LINE / WhatsApp / Telegram）', done: hasConnectedChannel, href: '/cs/settings' },
    { label: '收到第一則顧客訊息，確認 AI 能自動回覆', done: hasMessages, href: `${csUrl}` },
  ]

  const quickActions = [
    { icon: Sparkles,      label: '升級方案',      desc: '解鎖多平台、工單、報價計算機',      href: '/cs/settings', color: 'bg-fuchsia-50 dark:bg-fuchsia-950/50 text-fuchsia-600 dark:text-fuchsia-400' },
    { icon: MessageSquare, label: t('actionUnifiedInboxLabel'), desc: t('actionUnifiedInboxDesc'), href: `/cs/inbox?industry=${industry}`, color: 'bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400' },
    { icon: Inbox,       label: t('actionInboxLabel'),     desc: t('actionInboxDesc'),     href: csUrl, color: 'bg-sky-50 dark:bg-sky-950/50 text-sky-600 dark:text-sky-400' },
    { icon: FlaskConical,label: t('actionTestLabel'),      desc: t('actionTestDesc'),      href: csUrl, color: 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400' },
    { icon: Users,       label: t('actionCustomersLabel'), desc: t('actionCustomersDesc'), href: `/cs/customers?industry=${industry}`, color: 'bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400' },
    { icon: UserPlus,    label: t('actionCollabLabel'),    desc: t('actionCollabDesc'),    href: '/team?scope=cs', color: 'bg-teal-50 dark:bg-teal-950/50 text-teal-600 dark:text-teal-400' },
    { icon: Settings,    label: '頻道綁定', desc: '綁定 LINE / WhatsApp / Telegram', href: '/cs/settings', color: 'bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400' },
    { icon: Database,    label: t('actionDsLabel'),        desc: t('actionDsDesc'),        href: csUrl, color: 'bg-violet-50 dark:bg-violet-950/50 text-violet-600 dark:text-violet-400' },
    { icon: BarChart3,   label: t('actionAnalyticsLabel'), desc: t('actionAnalyticsDesc'), href: csUrl, color: 'bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400' },
  ]

  const indNameKey = `ind_${id}_name` as Parameters<typeof t>[0]
  const indTaglineKey = `ind_${id}_tagline` as Parameters<typeof t>[0]

  return (
    <div className="min-h-full bg-slate-50/50 dark:bg-background">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6 sm:space-y-8">

        {/* ── Hero Card ── */}
        <div className={`relative overflow-hidden rounded-3xl bg-gradient-to-br ${style.gradient} p-8 text-white shadow-lg`}>
          <div className="pointer-events-none absolute -top-16 -right-16 h-48 w-48 rounded-full bg-white/10 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-10 -left-10 h-36 w-36 rounded-full bg-white/10 blur-2xl" />

          <div className="relative flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="text-5xl leading-none">{style.emoji}</div>
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="inline-flex items-center gap-1.5 text-xs font-semibold bg-white/20 px-2.5 py-1 rounded-full">
                    <span className="h-1.5 w-1.5 rounded-full bg-green-300 animate-pulse" />
                    {t('running')}
                  </span>
                </div>
                <h1 className="text-2xl font-extrabold">{t('workbench', { name: t(indNameKey) })}</h1>
                <p className="text-sm text-white/80 mt-0.5">{t(indTaglineKey)}</p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <InstallInboxButton label="安裝手機" iosHint="點瀏覽器分享圖示 → 加入主畫面，把客服收件夾當 App 用。" />
              <Link href="/cs?select=1" className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white/20 hover:bg-white/30 transition-colors text-sm font-medium">
                <RefreshCw className="h-3.5 w-3.5" />
                {t('changeIndustry')}
              </Link>
              <Link href={csUrl} className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white text-gray-800 hover:bg-white/90 transition-colors text-sm font-semibold shadow-sm">
                <Settings className="h-3.5 w-3.5" />
                {t('fullSettings')}
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </div>
        </div>

        {/* ── Onboarding Checklist（活化前顯示，綁頻道+收到第一則訊息後自動消失）── */}
        {!onboardingDone && (
          <div className="bg-card rounded-2xl border p-5 shadow-sm">
            <div className="flex items-center gap-2 mb-1">
              <Sparkles className="h-4 w-4 text-primary" />
              <h2 className="font-semibold text-sm">新手上路：3 步驟開始使用</h2>
            </div>
            <p className="text-xs text-muted-foreground mb-4">完成以下步驟，體驗 AI 客服自動回覆的效果。</p>
            <div className="space-y-2">
              {onboardingSteps.map(step => (
                <Link key={step.label} href={step.href}
                  className={`flex items-center gap-2.5 rounded-xl border px-3 py-2.5 text-sm transition-colors ${
                    step.done ? 'border-transparent bg-emerald-50 dark:bg-emerald-950/30' : 'hover:border-primary/40 hover:bg-muted/40'
                  }`}>
                  {step.done
                    ? <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                    : <Circle className="h-4 w-4 text-muted-foreground/40 shrink-0" />}
                  <span className={step.done ? 'text-emerald-700 dark:text-emerald-400' : 'text-foreground'}>{step.label}</span>
                  {!step.done && <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/40 ml-auto shrink-0" />}
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* ── Stats ── */}
        <div className="grid grid-cols-3 gap-2 sm:gap-4">
          {[
            { label: t('todayMessages'), value: todayMessages, icon: MessageSquare, color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-50 dark:bg-blue-950/50', extra: null },
            { label: t('openTickets'),   value: openTickets,   icon: Ticket,        color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-50 dark:bg-amber-950/50', extra: null },
            {
              label: t('connectedPlatforms'),
              value: connectedPlatforms.length,
              icon: connectedPlatforms.length > 0 ? Wifi : WifiOff,
              color: connectedPlatforms.length > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground',
              bg: connectedPlatforms.length > 0 ? 'bg-emerald-50 dark:bg-emerald-950/50' : 'bg-muted/40',
              extra: connectedPlatforms,
            },
          ].map(stat => (
            <div key={stat.label} className="bg-card rounded-2xl border p-3 sm:p-5 shadow-sm">
              <div className="flex items-center gap-2 sm:gap-3 mb-2 sm:mb-3">
                <div className={`h-8 w-8 sm:h-9 sm:w-9 rounded-xl flex items-center justify-center shrink-0 ${stat.bg}`}>
                  <stat.icon className={`h-4 w-4 ${stat.color}`} />
                </div>
                <span className="text-[10px] sm:text-xs text-muted-foreground font-medium leading-tight">{stat.label}</span>
              </div>
              <div className="text-2xl sm:text-3xl font-bold tabular-nums">{stat.value}</div>
              {stat.extra && stat.extra.length > 0 && (
                <div className="mt-1 flex flex-wrap gap-1">
                  {stat.extra.slice(0, 3).map(p => (
                    <span key={p} className="text-[10px] text-muted-foreground">
                      {PLATFORM_LABELS[p]?.emoji ?? '🔗'} {PLATFORM_LABELS[p]?.name ?? p}
                    </span>
                  ))}
                </div>
              )}
              {stat.extra && stat.extra.length === 0 && (
                <div className="text-xs text-muted-foreground/60 mt-1">{t('noPlatform')}</div>
              )}
            </div>
          ))}
        </div>

        {/* ── Quick Actions ── */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{t('quickActions')}</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
            {quickActions.map(action => (
              <Link key={action.label} href={action.href} className="group bg-card rounded-2xl border p-5 shadow-sm hover:border-primary/40 hover:shadow-md transition-all">
                <div className="flex items-center gap-3 mb-2">
                  <div className={`h-10 w-10 rounded-xl flex items-center justify-center ${action.color} transition-transform group-hover:scale-110`}>
                    <action.icon className="h-5 w-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-sm">{action.label}</div>
                    <div className="text-xs text-muted-foreground">{action.desc}</div>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground/40 group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
                </div>
              </Link>
            ))}
          </div>
        </div>

        {/* ── System Status ── */}
        <div className="bg-card rounded-2xl border p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <Zap className="h-4 w-4 text-primary" />
            <h2 className="font-semibold text-sm">{t('systemStatus')}</h2>
          </div>
          <div className="space-y-2.5">
            {[
              { label: t('aiEngine'), ok: true },
              { label: t('webhook'),  ok: connectedPlatforms.length > 0 },
              { label: t('knowledgeBase'), ok: true },
            ].map(item => (
              <div key={item.label} className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">{item.label}</span>
                <span className={`flex items-center gap-1.5 text-xs font-medium ${item.ok ? 'text-emerald-600' : 'text-amber-600'}`}>
                  {item.ok
                    ? <><CheckCircle2 className="h-3.5 w-3.5" /> {t('statusOk')}</>
                    : <><WifiOff className="h-3.5 w-3.5" /> {t('statusNotSet')}</>
                  }
                </span>
              </div>
            ))}
          </div>
          <div className="mt-4 pt-4 border-t">
            <Link href={csUrl} className="flex items-center gap-1 text-xs text-primary font-medium hover:underline">
              {t('fullSettingsLink')} <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>

      </div>
    </div>
  )
}
