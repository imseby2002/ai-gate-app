'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations, useLocale } from 'next-intl'
import { LanguageSwitcher } from '@/components/layout/LanguageSwitcher'
import UnitPositionPicker from '@/components/hr/UnitPositionPicker'
import type { UnitOption } from '@/lib/hr/apply-units'

// 公開應徵表單：手機單欄，電腦雙欄
export default function ApplyForm({ code }: { code: string }) {
  const router = useRouter()
  const t = useTranslations('Apply')
  const locale = useLocale()
  const [form, setForm] = useState({ name: '', phone: '', email: '', position: '', store: '' })
  const [units, setUnits] = useState<UnitOption[]>([])
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  useEffect(() => {
    fetch(`/api/hr/apply/options?code=${encodeURIComponent(code)}`).then(r => r.ok ? r.json() : { units: [] }).then(d => setUnits(d.units ?? [])).catch(() => {})
  }, [code])

  const submit = async () => {
    if (!form.name.trim()) { setErr(t('nameRequired')); return }
    if (!form.store || !form.position.trim()) { setErr(t('unitRequired')); return }
    setBusy(true); setErr('')
    const res = await fetch('/api/hr/apply', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code, ...form, position: form.position.trim() }),
    })
    setBusy(false)
    const d = await res.json().catch(() => ({}))
    if (res.ok && d.token) router.replace(`/apply/edit/${d.token}`)
    else setErr(d.error ?? t('submitFailed'))
  }

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, [k]: e.target.value })
  const inp = 'w-full h-11 rounded-lg border border-slate-200 bg-white px-3 text-[15px] outline-none focus:ring-2 focus:ring-blue-500'

  return (
    <div className="min-h-screen bg-slate-50 flex justify-center px-4 py-6 md:py-14">
      <div className="w-full max-w-[460px] md:max-w-4xl">
        <div className="flex justify-end mb-2"><LanguageSwitcher currentLocale={locale} /></div>
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden md:grid md:grid-cols-[300px_1fr]">
          <div className="p-6 md:p-8 md:bg-blue-600 md:text-white">
            <h1 className="text-[22px] md:text-3xl font-bold">{t('applyTitle')}</h1>
            <p className="text-sm text-slate-500 md:text-blue-100 mt-1">{t('applySubtitle')}</p>
            <p className="hidden md:block text-sm text-blue-100 mt-6 leading-relaxed">{t('applyIntro')}</p>
          </div>
          <div className="px-6 pb-6 md:p-8">
            <div className="grid gap-3 md:grid-cols-2 md:gap-4">
              <F label={t('name')}><input className={inp} value={form.name} onChange={set('name')} autoComplete="name" /></F>
              <F label={t('phone')}><input className={inp} value={form.phone} onChange={set('phone')} inputMode="tel" autoComplete="tel" /></F>
              <div className="md:col-span-2"><F label={t('email')}><input className={inp} type="email" value={form.email} onChange={set('email')} autoComplete="email" /></F></div>
              <UnitPositionPicker units={units} store={form.store} position={form.position}
                onChange={(store, position) => setForm(f => ({ ...f, store, position }))} />
            </div>
            {err && <p className="text-red-600 text-[13px] mt-3">{err}</p>}
            <button onClick={submit} disabled={busy}
              className="mt-5 w-full h-11 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:bg-slate-400 text-white text-[15px] font-semibold">
              {busy ? t('submitting') : t('submit')}
            </button>
            <p className="md:hidden text-xs text-slate-500 mt-3">{t('applyIntro')}</p>
          </div>
        </div>
      </div>
    </div>
  )
}

function F({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-[13px] text-slate-600 mb-1">{label}</span>
      {children}
    </label>
  )
}
