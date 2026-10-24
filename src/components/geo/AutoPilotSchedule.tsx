'use client'

import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { CalendarClock, ChevronDown, ChevronUp, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface Schedule {
  enabled: boolean
  frequency: 'daily' | 'weekly'
  weekdays: number[]
  run_hour: number
  locale: string
  topics: string[]
  auto_topics: boolean
  promo_focus?: string
  last_run_at: string | null
  last_status: string | null
}

// GEO 自動巡航排程：每天或每週指定日自動產出一篇文章
export function AutoPilotSchedule({ suggested = [] }: { suggested?: string[] }) {
  const t = useTranslations('Marketing.geo')
  const [open, setOpen] = useState(false)
  const [s, setS] = useState<Schedule | null>(null)
  const [topicsText, setTopicsText] = useState('')
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')

  useEffect(() => {
    fetch('/api/marketing/geo/schedule').then(r => (r.ok ? r.json() : null)).then(d => {
      if (d?.schedule) { setS(d.schedule); setTopicsText((d.schedule.topics ?? []).join('\n')) }
    }).catch(() => {})
  }, [])

  if (!s) return null
  const set = (p: Partial<Schedule>) => setS(prev => (prev ? { ...prev, ...p } : prev))
  const days = [1, 2, 3, 4, 5, 6, 0]

  async function save(next?: Partial<Schedule>) {
    if (!s) return
    const body = { ...s, ...next, topics: topicsText.split('\n').map(x => x.trim()).filter(Boolean) }
    setSaving(true); setMsg('')
    try {
      const res = await fetch('/api/marketing/geo/schedule', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      const d = await res.json().catch(() => ({}))
      if (!res.ok) { setMsg(d.error || t('scheduleSaveFailed')); return }
      setS(d.schedule); setTopicsText((d.schedule.topics ?? []).join('\n')); setMsg(t('scheduleSaved'))
    } finally { setSaving(false) }
  }

  const summary = s.enabled
    ? (s.frequency === 'daily'
      ? t('scheduleSummaryDaily', { hour: s.run_hour })
      : t('scheduleSummaryWeekly', { days: s.weekdays.map(d => t(`weekday${d}`)).join('、'), hour: s.run_hour }))
    : t('scheduleOff')

  return (
    <div className="pt-2 border-t border-indigo-200/50 dark:border-indigo-800/50 space-y-2">
      <button type="button" onClick={() => setOpen(o => !o)} className="w-full flex items-center justify-between text-xs font-medium text-indigo-900 dark:text-indigo-200">
        <span className="flex items-center gap-1.5">
          <CalendarClock className="h-3.5 w-3.5 text-indigo-600" />
          {t('scheduleTitle')}
          <span className={`ml-1 px-1.5 py-0.5 rounded text-[10px] ${s.enabled ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>{summary}</span>
        </span>
        {open ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
      </button>

      {open && (
        <div className="rounded-lg border bg-card/80 p-3 space-y-3 text-xs">
          <label className="flex items-center gap-2 font-medium">
            <input type="checkbox" checked={s.enabled} onChange={e => set({ enabled: e.target.checked })} />
            {t('scheduleEnable')}
          </label>

          <div className="flex flex-wrap items-center gap-2">
            <span className="text-muted-foreground">{t('scheduleFrequency')}</span>
            {(['daily', 'weekly'] as const).map(f => (
              <button key={f} type="button" onClick={() => set({ frequency: f })}
                className={`px-2.5 py-1 rounded-full border ${s.frequency === f ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-background'}`}>
                {t(f === 'daily' ? 'scheduleDaily' : 'scheduleWeekly')}
              </button>
            ))}
            <span className="text-muted-foreground ml-2">{t('scheduleTime')}</span>
            <select value={s.run_hour} onChange={e => set({ run_hour: Number(e.target.value) })} className="h-7 rounded border px-1 bg-background">
              {Array.from({ length: 24 }, (_, h) => <option key={h} value={h}>{String(h).padStart(2, '0')}:00</option>)}
            </select>
            <span className="text-[10px] text-muted-foreground">{t('scheduleTz')}</span>
          </div>

          {s.frequency === 'weekly' && (
            <div className="flex flex-wrap gap-1.5">
              {days.map(d => {
                const on = s.weekdays.includes(d)
                return (
                  <button key={d} type="button"
                    onClick={() => set({ weekdays: on ? s.weekdays.filter(x => x !== d) : [...s.weekdays, d] })}
                    className={`w-9 h-7 rounded border ${on ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-background'}`}>
                    {t(`weekday${d}`)}
                  </button>
                )
              })}
            </div>
          )}

          <div className="flex items-center gap-2">
            <span className="text-muted-foreground">{t('scheduleLang')}</span>
            <select value={s.locale} onChange={e => set({ locale: e.target.value })} className="h-7 rounded border px-1 bg-background">
              <option value="zh-TW">繁體中文</option>
              <option value="vi">Tiếng Việt</option>
              <option value="en">English</option>
            </select>
          </div>

          <div className="space-y-1">
            <span className="font-medium">{t('promoFocus')}</span>
            <input value={s.promo_focus ?? ''} onChange={e => set({ promo_focus: e.target.value })}
              placeholder={t('promoFocusPh')} className="w-full h-8 rounded border px-2 bg-background text-xs" />
          </div>

          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <span className="font-medium">{t('scheduleTopics')}</span>
              {suggested.length > 0 && (
                <button type="button" className="text-[11px] text-indigo-600 hover:underline"
                  onClick={() => setTopicsText(prev => [...prev.split('\n').map(x => x.trim()).filter(Boolean), ...suggested.filter(x => !prev.includes(x))].join('\n'))}>
                  {t('scheduleAddSuggested')}
                </button>
              )}
            </div>
            <textarea value={topicsText} onChange={e => setTopicsText(e.target.value)} rows={4}
              placeholder={t('scheduleTopicsPlaceholder')} className="w-full rounded border p-2 bg-background text-xs" />
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={s.auto_topics} onChange={e => set({ auto_topics: e.target.checked })} />
              {t('scheduleAutoTopics')}
            </label>
          </div>

          <div className="flex items-center justify-between gap-2 flex-wrap">
            <span className="text-[11px] text-muted-foreground">
              {s.last_run_at ? t('scheduleLastRun', { time: new Date(s.last_run_at).toLocaleString(), status: s.last_status || '' }) : t('scheduleNeverRun')}
            </span>
            <div className="flex items-center gap-2">
              {msg && <span className="text-[11px] text-indigo-700">{msg}</span>}
              <Button size="sm" className="h-7 text-xs bg-indigo-600 hover:bg-indigo-700 text-white" disabled={saving} onClick={() => save()}>
                {saving && <Loader2 className="h-3 w-3 animate-spin mr-1" />}{t('scheduleSave')}
              </Button>
            </div>
          </div>
          <p className="text-[10px] text-muted-foreground">{t('scheduleNote')}</p>
        </div>
      )}
    </div>
  )
}
