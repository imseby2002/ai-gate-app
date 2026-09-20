'use client'

import Link from 'next/link'
import { useTranslations } from 'next-intl'
import {
  Headphones, ArrowRight, Sparkles, Shield,
  Clock, Star, TrendingUp, MessageSquare, Database, Calculator,
  FileText, Users, AlertTriangle, BarChart3,
  Search, Languages, Inbox, Ticket, ShoppingCart,
} from 'lucide-react'

const PLATFORMS = [
  { name: 'LINE OA', emoji: '💬', color: '#00B900' },
  { name: 'WhatsApp Business', emoji: '📱', color: '#25D366' },
  { name: 'WhatsApp Personal', emoji: '📲', color: '#128C7E' },
  { name: 'Telegram', emoji: '✈️', color: '#2AABEE' },
  { name: 'Zalo OA', emoji: '🔵', color: '#0068FF' },
  { name: 'WeChat', emoji: '💚', color: '#07C160' },
]

// 從 CsLanding 拆出來的行銷/功能介紹內容——CsLanding 只在「全新用戶第一次進來」跟
// 「選行業」時出現，已經在用的人平常看不到這些介紹。想重看功能總覽、或想轉給同事看
// 的人可以透過這頁（/cs/about）另外進來，不佔用日常工作流程。沿用同一份 CsLanding
// 翻譯字串，內容跟原本首頁的展示區塊一致。
export function CsAbout() {
  const t = useTranslations('CsLanding')
  type TKey = Parameters<typeof t>[0]

  const featureGroups = [
    {
      titleKey: 'fg_ai_title' as TKey,
      color: 'text-violet-700',
      features: [
        { icon: Sparkles,     labelKey: 'fg_ai_intent_label' as TKey,          descKey: 'fg_ai_intent_desc' as TKey,   live: true },
        { icon: Languages,    labelKey: 'fg_ai_lang_label' as TKey,            descKey: 'fg_ai_lang_desc' as TKey,     live: true },
        { icon: FileText,     labelKey: 'fg_ai_draft_label' as TKey,           descKey: 'fg_ai_draft_desc' as TKey,    live: false },
        { icon: MessageSquare,labelKey: 'fg_ai_summary_label' as TKey,         descKey: 'fg_ai_summary_desc' as TKey,  live: false },
      ],
    },
    {
      titleKey: 'fg_analytics_title' as TKey,
      color: 'text-blue-700',
      features: [
        { icon: BarChart3,    labelKey: 'fg_analytics_report_label' as TKey,   descKey: 'fg_analytics_report_desc' as TKey, live: false },
        { icon: TrendingUp,   labelKey: 'fg_analytics_trend_label' as TKey,    descKey: 'fg_analytics_trend_desc' as TKey,  live: false },
        { icon: Search,       labelKey: 'fg_analytics_hot_label' as TKey,      descKey: 'fg_analytics_hot_desc' as TKey,    live: false },
        { icon: Star,         labelKey: 'fg_analytics_survey_label' as TKey,   descKey: 'fg_analytics_survey_desc' as TKey, live: false },
      ],
    },
    {
      titleKey: 'fg_crm_title' as TKey,
      color: 'text-emerald-700',
      features: [
        { icon: Users,        labelKey: 'fg_crm_vip_label' as TKey,            descKey: 'fg_crm_vip_desc' as TKey,     live: false },
        { icon: AlertTriangle,labelKey: 'fg_crm_churn_label' as TKey,          descKey: 'fg_crm_churn_desc' as TKey,   live: false },
        { icon: ShoppingCart, labelKey: 'fg_crm_order_label' as TKey,          descKey: 'fg_crm_order_desc' as TKey,   live: true },
        { icon: Ticket,       labelKey: 'fg_crm_ticket_label' as TKey,         descKey: 'fg_crm_ticket_desc' as TKey,  live: true },
      ],
    },
    {
      titleKey: 'fg_int_title' as TKey,
      color: 'text-orange-700',
      features: [
        { icon: Inbox,        labelKey: 'fg_int_inbox_label' as TKey,          descKey: 'fg_int_inbox_desc' as TKey,   live: true },
        { icon: Database,     labelKey: 'fg_int_kb_label' as TKey,             descKey: 'fg_int_kb_desc' as TKey,      live: false },
        { icon: Calculator,   labelKey: 'fg_int_pricing_label' as TKey,        descKey: 'fg_int_pricing_desc' as TKey, live: true },
        { icon: Clock,        labelKey: 'fg_int_close_label' as TKey,          descKey: 'fg_int_close_desc' as TKey,   live: false },
      ],
    },
  ]

  return (
    <div className="min-h-full bg-gradient-to-b from-slate-50 to-white">

      {/* ── 主標語：不限則數 ── */}
      <div className="px-6 pt-6 max-w-5xl mx-auto">
        <div className="rounded-2xl bg-gradient-to-r from-primary to-violet-600 px-5 py-4 text-white text-center">
          <div className="inline-flex items-center gap-2 text-lg sm:text-2xl font-extrabold">
            <Sparkles className="h-5 w-5 shrink-0" />
            不限則數，不怕用量爆表加價
          </div>
          <p className="text-white/85 text-xs sm:text-sm mt-1">
            對話量再大，方案價格都固定——不像市場常見的「按則數計費」，用越多帳單越嚇人。
          </p>
        </div>
      </div>

      {/* ── Hero ── */}
      <div className="px-6 pt-8 pb-8 max-w-5xl mx-auto text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 text-primary text-xs font-semibold mb-5">
          <Sparkles className="h-3.5 w-3.5" />
          {t('badge')}
        </div>
        <h1 className="text-3xl sm:text-4xl font-extrabold text-gray-900 mb-3 leading-tight">
          {t('heroLine1')}
          <span className="bg-gradient-to-r from-primary to-violet-600 bg-clip-text text-transparent"> {t('heroLine2')}</span>
        </h1>
        <p className="text-gray-500 text-base max-w-2xl mx-auto mb-6 leading-relaxed">
          {t('heroDesc')}
        </p>

        <div className="flex flex-wrap justify-center gap-2 mb-2">
          {PLATFORMS.map(p => (
            <span key={p.name} className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full border bg-white text-xs text-gray-600 shadow-sm">
              <span>{p.emoji}</span>{p.name}
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: p.color }} />
            </span>
          ))}
        </div>
      </div>

      {/* ── Feature Showcase ── */}
      <div className="px-6 pb-12 max-w-5xl mx-auto">
        <div className="text-center mb-8">
          <h2 className="text-xl font-bold text-gray-900 mb-1">{t('featuresTitle')}</h2>
          <p className="text-sm text-gray-500">
            <span className="inline-flex items-center gap-1 mr-3">
              <span className="w-2 h-2 rounded-full bg-green-500 inline-block" />{t('live')}
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-gray-300 inline-block" />{t('dev')}
            </span>
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          {featureGroups.map(group => (
            <div key={group.titleKey} className="bg-white rounded-2xl border p-5">
              <h3 className={`font-bold text-sm mb-4 ${group.color}`}>{t(group.titleKey)}</h3>
              <div className="space-y-3">
                {group.features.map(f => {
                  const Icon = f.icon
                  return (
                    <div key={f.labelKey} className="flex items-start gap-3">
                      <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${f.live ? 'bg-green-50' : 'bg-gray-100'}`}>
                        <Icon className={`h-3.5 w-3.5 ${f.live ? 'text-green-600' : 'text-gray-400'}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-semibold text-gray-800">{t(f.labelKey)}</span>
                          <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${f.live ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>{f.live ? t('live') : t('dev')}</span>
                        </div>
                        <p className="text-[11px] text-gray-400 mt-0.5 leading-relaxed">{t(f.descKey)}</p>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── CTA ── */}
      <div className="px-6 pb-16 max-w-5xl mx-auto text-center">
        <div className="bg-gradient-to-br from-primary/5 to-violet-500/5 rounded-3xl border border-primary/10 p-10">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">{t('ctaTitle')}</h2>
          <p className="text-gray-500 text-sm mb-6">{t('ctaDesc')}</p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link
              href="/cs/dashboard"
              className="inline-flex items-center gap-2 px-7 py-3.5 rounded-xl text-sm font-bold text-white shadow-lg transition-all hover:shadow-xl hover:-translate-y-0.5"
              style={{ background: 'linear-gradient(135deg, var(--primary), color-mix(in oklch, var(--primary) 60%, violet))' }}
            >
              <Headphones className="h-4 w-4" />
              {t('ctaButton')}
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
          <p className="text-xs text-gray-400 mt-4 flex items-center justify-center gap-1">
            <Shield className="h-3.5 w-3.5" /> {t('ctaNote')}
          </p>
        </div>
      </div>
    </div>
  )
}
