'use client'

import { useState } from 'react'
import { BookOpen, ChevronDown, ExternalLink, AlertTriangle } from 'lucide-react'
import type { PlatformGuide } from '@/lib/platform-guides'
import { useTranslations } from 'next-intl'

// 平台卡片內的「詳細設定教學」折疊區：一步一步中文教學＋注意事項＋官方文件
export default function PlatformGuidePanel({ guide }: { guide?: PlatformGuide }) {
  const t = useTranslations('MktPlatforms.guide')
  const [open, setOpen] = useState(false)
  if (!guide) return null
  let n = 0
  return (
    <div className="mb-3 rounded-xl border bg-muted/30">
      <button type="button" onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between gap-2 px-3 py-2.5 text-sm font-medium text-primary">
        <span className="flex items-center gap-1.5"><BookOpen className="h-4 w-4" /> {t('title')}</span>
        <ChevronDown className={`h-4 w-4 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="px-3 pb-3 space-y-4 text-[13px] leading-relaxed">
          <p className="text-muted-foreground">{guide.summary}</p>
          {guide.sections.map(sec => (
            <div key={sec.title}>
              <p className="font-semibold mb-1.5">{sec.title}</p>
              <ol className="space-y-1.5">
                {sec.steps.map(step => {
                  n += 1
                  return (
                    <li key={step} className="flex gap-2">
                      <span className="shrink-0 w-5 h-5 rounded-full bg-primary/10 text-primary text-[11px] font-semibold flex items-center justify-center mt-0.5">{n}</span>
                      <span className="break-words min-w-0">{step}</span>
                    </li>
                  )
                })}
              </ol>
            </div>
          ))}
          {guide.warnings && guide.warnings.length > 0 && (
            <div className="rounded-lg bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 px-3 py-2 space-y-1">
              {guide.warnings.map(w => (
                <p key={w} className="flex gap-1.5"><AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />{w}</p>
              ))}
            </div>
          )}
          <div className="flex flex-wrap gap-x-3 gap-y-1">
            <span className="text-muted-foreground">{t('docs')}</span>
            {guide.links.map(l => (
              <a key={l.url} href={l.url} target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-0.5 text-primary hover:underline">
                {l.label} <ExternalLink className="h-3 w-3" />
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
