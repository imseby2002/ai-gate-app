/**
 * TradingAgents 介紹與費用（www.im-tourist.com/portal/trading-agents，公開頁）
 * 內容對應 lib/trading-agents（四位分析師、多空辯論、交易員、風控、投資經理、十種估值模型）；
 * 費用：每次分析依實際 AI 用量扣點（app/api/trading-agents/run）。
 */
import type { Metadata } from 'next'
import Link from 'next/link'
import { getLocale, getTranslations } from 'next-intl/server'
import { ArrowRight, BarChart3, Calculator, Gavel, LineChart, Newspaper, ShieldCheck, Users } from 'lucide-react'
import { LanguageSwitcher } from '@/components/layout/LanguageSwitcher'
import { BrandLogo } from '@/components/layout/BrandLogo'

export const dynamic = 'force-dynamic'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('Portal.tradingPage')
  return { title: t('metaTitle'), description: t('metaDesc') }
}

const STEPS = [
  { key: 'analysts', icon: Newspaper },
  { key: 'valuation', icon: Calculator },
  { key: 'debate', icon: Users },
  { key: 'trader', icon: LineChart },
  { key: 'risk', icon: ShieldCheck },
  { key: 'manager', icon: Gavel },
] as const

export default async function TradingAgentsIntroPage() {
  const t = await getTranslations('Portal.tradingPage')
  const locale = await getLocale()
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="bg-[#0b1220] text-white">
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <nav className="flex items-center gap-3 py-5">
            <Link href="/" className="flex items-center gap-2"><BrandLogo className="h-8 w-8" /><b>AI GATE</b></Link>
            <div className="ml-auto flex items-center gap-4 text-sm text-slate-300">
              <a href="#pricing" className="hover:text-white">{t('navPricing')}</a>
              <LanguageSwitcher currentLocale={locale} />
            </div>
          </nav>
          <div className="pt-8 pb-14">
            <p className="font-mono text-[12px] tracking-[0.16em] text-emerald-300">TRADINGAGENTS</p>
            <h1 className="mt-3 text-[clamp(28px,5.4vw,50px)] font-black leading-tight">{t('title')}</h1>
            <p className="mt-4 max-w-2xl text-slate-300">{t('desc')}</p>
            <a href="/trading-agents" className="mt-7 inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-emerald-500 text-slate-950 font-bold hover:bg-emerald-400">
              {t('start')} <ArrowRight className="h-4 w-4" />
            </a>
          </div>
        </div>
      </header>

      <section className="max-w-5xl mx-auto px-4 sm:px-6 py-12">
        <h2 className="text-2xl font-black mb-5">{t('howTitle')}</h2>
        <ol className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {STEPS.map((s, i) => (
            <li key={s.key} className="rounded-2xl border bg-white p-5">
              <div className="flex items-center gap-3">
                <span className="h-9 w-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center"><s.icon className="h-5 w-5" /></span>
                <span className="text-xs font-mono text-slate-400">0{i + 1}</span>
              </div>
              <h3 className="mt-3 font-bold">{t(`steps.${s.key}.title`)}</h3>
              <p className="mt-1.5 text-sm text-slate-600">{t(`steps.${s.key}.desc`)}</p>
            </li>
          ))}
        </ol>
        <div className="mt-6 rounded-2xl border bg-white p-5 flex gap-3">
          <BarChart3 className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
          <p className="text-sm text-slate-600">{t('options')}</p>
        </div>
      </section>

      <section id="pricing" className="max-w-5xl mx-auto px-4 sm:px-6 pb-12">
        <h2 className="text-2xl font-black mb-5">{t('pricingTitle')}</h2>
        <div className="rounded-2xl border-2 border-emerald-500 bg-white p-6">
          <div className="font-bold text-lg">{t('pricingHead')}</div>
          <p className="mt-2 text-sm text-slate-600">{t('pricingDesc')}</p>
          <ul className="mt-4 space-y-1.5 text-sm text-slate-700 list-disc pl-5">
            <li>{t('pricing1')}</li>
            <li>{t('pricing2')}</li>
            <li>{t('pricing3')}</li>
          </ul>
          <a href="https://marketing.im-tourist.com/intro/enterprise" className="mt-5 inline-block text-sm font-bold text-emerald-700 hover:underline">{t('enterprise')}</a>
        </div>
      </section>

      <section className="max-w-5xl mx-auto px-4 sm:px-6 pb-16">
        <p className="rounded-xl bg-amber-50 border border-amber-200 p-4 text-[13px] text-amber-900">{t('disclaimer')}</p>
      </section>

      <footer className="border-t py-6 text-center text-xs text-slate-500 space-x-4">
        <Link href="/" className="hover:text-slate-700">{t('home')}</Link>
        <Link href="/privacy" className="hover:text-slate-700">{t('privacy')}</Link>
      </footer>
    </div>
  )
}
