'use client'

import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { ArrowLeft } from 'lucide-react'

interface Section {
  id: string
  title: string
  summary: string
  steps?: string[]
  faq?: { q: string; a: string }[]
}

const getSections = (t: (key: string) => string): Section[] => [
  {
    id: 'channels',
    title: t('sec1Title'),
    summary: t('sec1Summary'),
    steps: [t('sec1Step1'), t('sec1Step2'), t('sec1Step3'), t('sec1Step4'), t('sec1Step5')],
    faq: [
      { q: t('sec1FaqQ1'), a: t('sec1FaqA1') },
      { q: t('sec1FaqQ2'), a: t('sec1FaqA2') },
    ],
  },
  {
    id: 'platforms',
    title: t('sec2Title'),
    summary: t('sec2Summary'),
    steps: [t('sec2Step1'), t('sec2Step2'), t('sec2Step3')],
  },
  {
    id: 'ai-settings',
    title: t('sec3Title'),
    summary: t('sec3Summary'),
    steps: [t('sec3Step1'), t('sec3Step2'), t('sec3Step3'), t('sec3Step4'), t('sec3Step5'), t('sec3Step6')],
    faq: [
      { q: t('sec3FaqQ1'), a: t('sec3FaqA1') },
    ],
  },
  {
    id: 'dialogue-files',
    title: t('sec4Title'),
    summary: t('sec4Summary'),
    steps: [t('sec4Step1'), t('sec4Step2'), t('sec4Step3')],
  },
  {
    id: 'data-sources',
    title: t('sec5Title'),
    summary: t('sec5Summary'),
    steps: [t('sec5Step1'), t('sec5Step2'), t('sec5Step3'), t('sec5Step4')],
    faq: [
      { q: t('sec5FaqQ1'), a: t('sec5FaqA1') },
    ],
  },
  {
    id: 'pricing',
    title: t('sec6Title'),
    summary: t('sec6Summary'),
    steps: [t('sec6Step1'), t('sec6Step2'), t('sec6Step3'), t('sec6Step4')],
  },
  {
    id: 'test',
    title: t('sec7Title'),
    summary: t('sec7Summary'),
    steps: [t('sec7Step1'), t('sec7Step2'), t('sec7Step3')],
  },
  {
    id: 'logs',
    title: t('sec8Title'),
    summary: t('sec8Summary'),
  },
  {
    id: 'tickets',
    title: t('sec9Title'),
    summary: t('sec9Summary'),
  },
  {
    id: 'inbox',
    title: t('sec10Title'),
    summary: t('sec10Summary'),
  },
]

export function CsHelp() {
  const t = useTranslations('CsHelp')
  const SECTIONS = getSections(t)
  return (
    <div className="min-h-full bg-slate-50/50 dark:bg-background">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6">
        <div className="flex items-center gap-3">
          <Link href="/cs" className="text-muted-foreground hover:text-foreground"><ArrowLeft className="h-5 w-5" /></Link>
          <div>
            <h1 className="text-lg sm:text-xl font-bold">{t('pageTitle')}</h1>
            <p className="text-xs text-muted-foreground mt-0.5">{t('pageDesc')}</p>
          </div>
        </div>

        {/* 目錄 */}
        <nav className="bg-card rounded-2xl border p-4 flex flex-wrap gap-2">
          {SECTIONS.map(s => (
            <a key={s.id} href={`#${s.id}`}
              className="text-xs px-3 py-1.5 rounded-full bg-muted hover:bg-accent text-foreground/80 transition-colors">
              {s.title}
            </a>
          ))}
        </nav>

        {SECTIONS.map(s => (
          <section key={s.id} id={s.id} className="bg-card rounded-2xl border p-5 sm:p-6 scroll-mt-6">
            <h2 className="text-base font-bold mb-2">{s.title}</h2>
            <p className="text-sm text-muted-foreground leading-relaxed mb-4">{s.summary}</p>

            {s.steps && (
              <ol className="space-y-2 mb-4">
                {s.steps.map((step, i) => (
                  <li key={i} className="flex gap-2 text-sm">
                    <span className="shrink-0 h-5 w-5 rounded-full bg-primary/10 text-primary text-[11px] font-semibold flex items-center justify-center mt-0.5">{i + 1}</span>
                    <span className="leading-relaxed">{step}</span>
                  </li>
                ))}
              </ol>
            )}

            {s.faq && s.faq.length > 0 && (
              <div className="mt-4 pt-4 border-t space-y-3">
                <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{t('faqLabel')}</div>
                {s.faq.map((f, i) => (
                  <div key={i} className="text-sm">
                    <div className="font-medium text-foreground">{t('qPrefix')}{f.q}</div>
                    <div className="text-muted-foreground mt-0.5">{t('aPrefix')}{f.a}</div>
                  </div>
                ))}
              </div>
            )}
          </section>
        ))}

        <div className="text-center py-4">
          <Link href="/cs/settings" className="text-sm text-primary font-medium hover:underline">
            {t('goToChannelsLink')}
          </Link>
        </div>
      </div>
    </div>
  )
}
