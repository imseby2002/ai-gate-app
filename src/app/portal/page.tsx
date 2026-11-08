/**
 * 公司總頁（www.im-tourist.com）：介紹所有系統、直接進入各系統、各系統費用與企業方案。
 * 系統名稱與說明沿用 lib/systems.ts（三語）；登入後的主控台改在 /dashboard。
 */
import type { Metadata } from 'next'
import Link from 'next/link'
import { getLocale, getTranslations } from 'next-intl/server'
import {
  ArrowRight, Bot, BedDouble, Briefcase, Building2, CalendarClock, Globe2, Headphones,
  LineChart, Megaphone, MessageSquare, PhoneCall, Smartphone,
} from 'lucide-react'
import { getLocalizedSystems, SYSTEM_SUBDOMAIN, type SystemKey } from '@/lib/systems'
import { LanguageSwitcher } from '@/components/layout/LanguageSwitcher'
import { BrandLogo } from '@/components/layout/BrandLogo'

export const dynamic = 'force-dynamic'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('Portal')
  return { title: t('metaTitle'), description: t('metaDesc') }
}

const ROOT = 'im-tourist.com'
const sub = (s: string, path = '/') => `https://${s}.${ROOT}${path}`

// 有獨立介紹頁與方案頁的系統（app/intro 依子網域顯示）
const HAS_INTRO = new Set(['marketing', 'cs', 'booking', 'reserve'])

const ORDER: { key: SystemKey; icon: typeof Bot }[] = [
  { key: 'marketing', icon: Megaphone },
  { key: 'cs', icon: Headphones },
  { key: 'booking', icon: BedDouble },
  { key: 'reserve', icon: CalendarClock },
  { key: 'office', icon: Building2 },
  { key: 'agent', icon: Bot },
  { key: 'chat', icon: MessageSquare },
  { key: 'resume', icon: Briefcase },
  { key: 'leads', icon: PhoneCall },
]

function entryUrl(key: SystemKey): string {
  if (key === 'leads') return sub('marketing', '/prospect-call')
  const s = SYSTEM_SUBDOMAIN[key]
  return s ? sub(s) : sub('www', '/apps')
}

export default async function PortalPage() {
  const t = await getTranslations('Portal')
  const locale = await getLocale()
  const systems = getLocalizedSystems(locale)

  const cards = [
    ...ORDER.map(({ key, icon }) => ({
      id: key as string,
      icon,
      label: systems[key].label,
      desc: systems[key].desc,
      enter: entryUrl(key),
      intro: HAS_INTRO.has(key) ? sub(SYSTEM_SUBDOMAIN[key]!, '/intro') : null,
    })),
    { id: 'trading-agents', icon: LineChart, label: t('trading.label'), desc: t('trading.desc'), enter: sub('www', '/trading-agents'), intro: null },
    { id: 'esim', icon: Smartphone, label: t('esim.label'), desc: t('esim.desc'), enter: sub('esim'), intro: null },
  ]

  const pricing = [
    { label: systems.marketing.label, href: sub('marketing', '/intro/pricing') },
    { label: systems.cs.label, href: sub('cs', '/intro/pricing') },
    { label: systems.booking.label, href: sub('booking', '/intro/pricing') },
    { label: systems.reserve.label, href: sub('reserve', '/intro/pricing') },
  ]

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-sky-50 text-slate-900">
      <header className="flex items-center justify-between gap-3 px-4 sm:px-8 py-4 border-b bg-white/80 backdrop-blur sticky top-0 z-10">
        <Link href="/" className="flex items-center gap-2 min-w-0">
          <BrandLogo className="h-9 w-9" />
          <span className="font-bold truncate">AI GATE</span>
        </Link>
        <nav className="flex items-center gap-3 sm:gap-5 text-sm">
          <a href="#systems" className="hidden sm:inline hover:text-indigo-600">{t('nav.systems')}</a>
          <a href="#pricing" className="hidden sm:inline hover:text-indigo-600">{t('nav.pricing')}</a>
          <LanguageSwitcher currentLocale={locale} />
          <Link href="/dashboard" className="px-3 py-1.5 rounded-lg bg-indigo-600 text-white font-semibold hover:bg-indigo-700">{t('nav.console')}</Link>
        </nav>
      </header>

      <section className="px-4 sm:px-8 pt-14 pb-10 max-w-5xl mx-auto text-center">
        <h1 className="text-3xl sm:text-5xl font-extrabold leading-tight">{t('hero.title')}</h1>
        <p className="mt-4 text-base sm:text-lg text-slate-600 max-w-2xl mx-auto">{t('hero.desc')}</p>
        <div className="mt-7 flex flex-wrap justify-center gap-3">
          <a href="#systems" className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-indigo-600 text-white font-bold hover:bg-indigo-700">
            {t('hero.explore')} <ArrowRight className="h-4 w-4" />
          </a>
          <a href={sub('marketing', '/intro/enterprise')} className="inline-flex items-center gap-2 px-5 py-3 rounded-xl border bg-white font-bold hover:border-indigo-300">
            {t('hero.enterprise')}
          </a>
        </div>
      </section>

      <section id="systems" className="px-4 sm:px-8 pb-14 max-w-6xl mx-auto">
        <h2 className="text-xl sm:text-2xl font-bold mb-5">{t('systemsTitle')}</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {cards.map(c => (
            <div key={c.id} className="rounded-2xl border bg-white p-5 shadow-sm flex flex-col">
              <div className="flex items-center gap-3">
                <span className="h-10 w-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center"><c.icon className="h-5 w-5" /></span>
                <h3 className="font-bold">{c.label}</h3>
              </div>
              <p className="mt-3 text-sm text-slate-600 flex-1">{c.desc}</p>
              <div className="mt-4 flex gap-2 text-sm">
                <a href={c.enter} className="px-3 py-1.5 rounded-lg bg-indigo-600 text-white font-semibold hover:bg-indigo-700">{t('enter')}</a>
                {c.intro && <a href={c.intro} className="px-3 py-1.5 rounded-lg border font-semibold hover:border-indigo-300">{t('learnMore')}</a>}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section id="pricing" className="px-4 sm:px-8 pb-16 max-w-5xl mx-auto">
        <h2 className="text-xl sm:text-2xl font-bold mb-2">{t('pricingTitle')}</h2>
        <p className="text-sm text-slate-600 mb-5">{t('pricingDesc')}</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <a href={sub('marketing', '/intro/enterprise')} className="sm:col-span-2 rounded-2xl border-2 border-indigo-500 bg-white p-5 flex items-center justify-between gap-3 hover:shadow-md">
            <span>
              <span className="flex items-center gap-2 font-bold text-indigo-700"><Globe2 className="h-4 w-4" /> {t('enterprise.title')}</span>
              <span className="block mt-1 text-sm text-slate-600">{t('enterprise.desc')}</span>
            </span>
            <ArrowRight className="h-5 w-5 text-indigo-600 shrink-0" />
          </a>
          {pricing.map(p => (
            <a key={p.href} href={p.href} className="rounded-2xl border bg-white p-5 flex items-center justify-between gap-3 hover:border-indigo-300">
              <span className="font-semibold">{t('pricingOf', { name: p.label })}</span>
              <ArrowRight className="h-4 w-4 text-slate-400" />
            </a>
          ))}
          <div className="rounded-2xl border bg-white p-5 text-sm text-slate-600">{t('pricingOthers')}</div>
        </div>
      </section>

      <footer className="border-t py-6 text-center text-xs text-slate-500 space-x-4">
        <Link href="/privacy" className="hover:text-slate-700">{t('privacy')}</Link>
        <span>© AI GATE</span>
      </footer>
    </div>
  )
}
