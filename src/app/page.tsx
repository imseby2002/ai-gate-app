import Link from 'next/link'
import { Zap, Bot, BarChart3, Shield, MessageSquare, Image, Video } from 'lucide-react'
import { getTranslations } from 'next-intl/server'
import { getLocale } from 'next-intl/server'
import { LanguageSwitcher } from '@/components/layout/LanguageSwitcher'

export default async function LandingPage() {
  const t = await getTranslations('Landing')
  const locale = await getLocale()

  const features = [
    { icon: MessageSquare, title: t('features.routing.title'), desc: t('features.routing.desc') },
    { icon: Bot,           title: t('features.assistant.title'), desc: t('features.assistant.desc') },
    { icon: BarChart3,     title: t('features.usage.title'), desc: t('features.usage.desc') },
    { icon: Image,         title: t('features.image.title'), desc: t('features.image.desc') },
    { icon: Video,         title: t('features.video.title'), desc: t('features.video.desc') },
    { icon: Shield,        title: t('features.employee.title'), desc: t('features.employee.desc') },
  ]

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50">
      {/* Header */}
      <header className="flex items-center justify-between px-8 py-5 border-b bg-white/80 backdrop-blur">
        <div className="flex items-center gap-2">
          <Zap className="h-7 w-7 text-primary" style={{ color: 'var(--primary)' }} />
          <span className="text-2xl font-bold tracking-tight">AI GATE</span>
        </div>
        <div className="flex items-center gap-3">
          <LanguageSwitcher currentLocale={locale} />
          <Link
            href="/login"
            className="px-4 py-2 rounded-lg border text-sm font-medium hover:bg-gray-50 transition-colors"
          >
            {t('signIn')}
          </Link>
          <Link
            href="/register"
            className="px-4 py-2 rounded-lg text-sm font-medium text-white transition-colors"
            style={{ background: 'var(--primary)' }}
          >
            {t('freeTrial')}
          </Link>
        </div>
      </header>

      {/* Hero */}
      <main className="max-w-5xl mx-auto px-8 py-24 text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm font-medium mb-6"
          style={{ background: 'color-mix(in oklch, var(--primary) 10%, transparent)', color: 'var(--primary)' }}>
          <Zap className="h-3.5 w-3.5" />
          {t('badge')}
        </div>

        <h1 className="text-5xl font-bold tracking-tight mb-6 leading-tight">
          {t('heroLine1')}
          <br />
          <span style={{ color: 'var(--primary)' }}>{t('heroLine2')}</span>
        </h1>

        <p className="text-xl text-gray-600 mb-10 max-w-2xl mx-auto leading-relaxed">
          {t('heroDesc')}
        </p>

        <div className="flex items-center justify-center gap-4">
          <Link
            href="/register"
            className="px-8 py-3 rounded-xl text-base font-semibold text-white shadow-lg transition-all hover:shadow-xl hover:scale-105"
            style={{ background: 'var(--primary)' }}
          >
            {t('ctaStart')}
          </Link>
          <Link
            href="/login"
            className="px-8 py-3 rounded-xl text-base font-semibold border-2 transition-all hover:bg-gray-50"
          >
            {t('ctaLogin')}
          </Link>
        </div>

        {/* Features Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-24 text-left">
          {features.map((f) => (
            <div key={f.title} className="p-6 rounded-2xl border bg-white shadow-sm hover:shadow-md transition-shadow">
              <div className="h-10 w-10 rounded-xl flex items-center justify-center mb-4"
                style={{ background: 'color-mix(in oklch, var(--primary) 10%, transparent)' }}>
                <f.icon className="h-5 w-5" style={{ color: 'var(--primary)' }} />
              </div>
              <h3 className="font-semibold text-lg mb-2">{f.title}</h3>
              <p className="text-gray-600 text-sm leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>

        {/* Model logos */}
        <div className="mt-20">
          <p className="text-sm text-gray-500 mb-6">{t('integratedServices')}</p>
          <div className="flex flex-wrap items-center justify-center gap-6">
            {['DeepSeek', 'Gemini', 'Claude', 'Perplexity', 'FLUX', 'Kling', 'VEO3'].map(name => (
              <span key={name} className="px-4 py-2 rounded-lg border bg-white text-sm font-medium text-gray-600 shadow-sm">
                {name}
              </span>
            ))}
          </div>
        </div>
      </main>
    </div>
  )
}
