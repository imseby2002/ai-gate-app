'use client'

import Link from 'next/link'
import { InstallInboxButton } from './inbox/InstallInboxButton'
import { useState } from 'react'
import { useTranslations } from 'next-intl'
import {
  Headphones, ArrowRight, Sparkles, Shield, Globe,
  Clock, Star, TrendingUp, MessageSquare, Database, Calculator,
  FlaskConical, ClipboardList, Users, AlertTriangle, BarChart3,
  Search, FileText, Languages, Inbox, Ticket, ShoppingCart, ChevronRight,
} from 'lucide-react'

const INDUSTRY_IDS = ['homestay', 'ecommerce', 'restaurant', 'clinic', 'beauty', 'education'] as const

const INDUSTRY_STYLES = {
  homestay:  { emoji: '🏡', color: 'from-teal-500 to-emerald-600',   bg: 'bg-teal-50',   border: 'border-teal-200' },
  ecommerce: { emoji: '🛍️', color: 'from-orange-500 to-amber-600',  bg: 'bg-orange-50', border: 'border-orange-200' },
  restaurant:{ emoji: '🍽️', color: 'from-red-500 to-rose-600',       bg: 'bg-red-50',    border: 'border-red-200' },
  clinic:    { emoji: '🏥', color: 'from-blue-500 to-indigo-600',    bg: 'bg-blue-50',   border: 'border-blue-200' },
  beauty:    { emoji: '💆', color: 'from-pink-500 to-rose-600',      bg: 'bg-pink-50',   border: 'border-pink-200' },
  education: { emoji: '📚', color: 'from-violet-500 to-purple-600',  bg: 'bg-violet-50', border: 'border-violet-200' },
} as const

const PLATFORMS = [
  { name: 'LINE OA', emoji: '💬', color: '#00B900' },
  { name: 'WhatsApp Business', emoji: '📱', color: '#25D366' },
  { name: 'WhatsApp Personal', emoji: '📲', color: '#128C7E' },
  { name: 'Telegram', emoji: '✈️', color: '#2AABEE' },
  { name: 'Zalo OA', emoji: '🔵', color: '#0068FF' },
  { name: 'WeChat', emoji: '💚', color: '#07C160' },
]

export function CsLanding() {
  const t = useTranslations('CsLanding')
  const [hoveredIndustry, setHoveredIndustry] = useState<string | null>(null)

  type TKey = Parameters<typeof t>[0]

  const featureGroups = [
    {
      titleKey: 'fg_ai_title' as TKey,
      color: 'text-violet-700',
      features: [
        { icon: Sparkles,     labelKey: 'fg_ai_intent_label' as TKey,          descKey: 'fg_ai_intent_desc' as TKey },
        { icon: Languages,    labelKey: 'fg_ai_lang_label' as TKey,            descKey: 'fg_ai_lang_desc' as TKey },
        { icon: FileText,     labelKey: 'fg_ai_draft_label' as TKey,           descKey: 'fg_ai_draft_desc' as TKey },
        { icon: MessageSquare,labelKey: 'fg_ai_summary_label' as TKey,         descKey: 'fg_ai_summary_desc' as TKey },
      ],
    },
    {
      titleKey: 'fg_analytics_title' as TKey,
      color: 'text-blue-700',
      features: [
        { icon: BarChart3,    labelKey: 'fg_analytics_report_label' as TKey,   descKey: 'fg_analytics_report_desc' as TKey },
        { icon: TrendingUp,   labelKey: 'fg_analytics_trend_label' as TKey,    descKey: 'fg_analytics_trend_desc' as TKey },
        { icon: Search,       labelKey: 'fg_analytics_hot_label' as TKey,      descKey: 'fg_analytics_hot_desc' as TKey },
        { icon: Star,         labelKey: 'fg_analytics_survey_label' as TKey,   descKey: 'fg_analytics_survey_desc' as TKey },
      ],
    },
    {
      titleKey: 'fg_crm_title' as TKey,
      color: 'text-emerald-700',
      features: [
        { icon: Users,        labelKey: 'fg_crm_vip_label' as TKey,            descKey: 'fg_crm_vip_desc' as TKey },
        { icon: AlertTriangle,labelKey: 'fg_crm_churn_label' as TKey,          descKey: 'fg_crm_churn_desc' as TKey },
        { icon: ShoppingCart, labelKey: 'fg_crm_order_label' as TKey,          descKey: 'fg_crm_order_desc' as TKey },
        { icon: Ticket,       labelKey: 'fg_crm_ticket_label' as TKey,         descKey: 'fg_crm_ticket_desc' as TKey },
      ],
    },
    {
      titleKey: 'fg_int_title' as TKey,
      color: 'text-orange-700',
      features: [
        { icon: Inbox,        labelKey: 'fg_int_inbox_label' as TKey,          descKey: 'fg_int_inbox_desc' as TKey },
        { icon: Database,     labelKey: 'fg_int_kb_label' as TKey,             descKey: 'fg_int_kb_desc' as TKey },
        { icon: Calculator,   labelKey: 'fg_int_pricing_label' as TKey,        descKey: 'fg_int_pricing_desc' as TKey },
        { icon: Clock,        labelKey: 'fg_int_close_label' as TKey,          descKey: 'fg_int_close_desc' as TKey },
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

        <div className="flex flex-wrap justify-center gap-2 mb-8">
          {PLATFORMS.map(p => (
            <span key={p.name} className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full border bg-white text-xs text-gray-600 shadow-sm">
              <span>{p.emoji}</span>{p.name}
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: p.color }} />
            </span>
          ))}
        </div>
      </div>

      <div className="flex justify-center px-6 -mt-2 mb-6">
        <InstallInboxButton label="安裝手機" iosHint="點瀏覽器分享圖示 → 加入主畫面，把客服收件夾當 App 用。" />
      </div>
      {/* ── Industry Templates ── */}
      <div className="px-6 pb-10 max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-xl font-bold text-gray-900">{t('chooseIndustry')}</h2>
            <p className="text-sm text-gray-500 mt-0.5">{t('chooseIndustryDesc')}</p>
          </div>
          <Link href="/cs/workspace" className="hidden sm:flex items-center gap-1.5 text-sm text-primary font-medium hover:underline">
            {t('skip')} <ChevronRight className="h-4 w-4" />
          </Link>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {INDUSTRY_IDS.map(id => {
            const s = INDUSTRY_STYLES[id]
            const nameKey = `ind_${id}_name` as TKey
            const descKey = `ind_${id}_desc` as TKey
            const tags = [0, 1, 2, 3].map(i => t(`ind_${id}_tag${i}` as TKey))
            return (
              <Link
                key={id}
                href={`/cs/workspace?industry=${id}`}
                onMouseEnter={() => setHoveredIndustry(id)}
                onMouseLeave={() => setHoveredIndustry(null)}
                className={`group relative rounded-2xl border-2 p-5 bg-white hover:shadow-lg transition-all hover:-translate-y-0.5 cursor-pointer ${
                  hoveredIndustry === id ? s.border : 'border-gray-100'
                }`}
              >
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center mb-3 bg-gradient-to-br ${s.color} text-2xl`}>
                  {s.emoji}
                </div>
                <h3 className="font-bold text-gray-900 text-sm mb-1">{t(nameKey)}</h3>
                <p className="text-xs text-gray-500 leading-relaxed mb-3">{t(descKey)}</p>
                <div className="flex flex-wrap gap-1">
                  {tags.map(tag => (
                    <span key={tag} className={`text-[10px] px-1.5 py-0.5 rounded-full ${s.bg} text-gray-600`}>{tag}</span>
                  ))}
                </div>
                <div className="absolute bottom-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
                  <ArrowRight className="h-4 w-4 text-gray-400" />
                </div>
              </Link>
            )
          })}
        </div>

        <div className="mt-3 text-center">
          <Link href="/cs/workspace" className="text-xs text-gray-400 hover:text-gray-600 transition-colors">
            {t('manualConfig')}
          </Link>
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
                      <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5 bg-green-50">
                        <Icon className="h-3.5 w-3.5 text-green-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-semibold text-gray-800">{t(f.labelKey)}</span>
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-green-100 text-green-700 font-medium">{t('live')}</span>
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
              href="/cs/workspace"
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
