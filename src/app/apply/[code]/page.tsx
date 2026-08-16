'use client'

import { useState, use } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations, useLocale } from 'next-intl'
import { LanguageSwitcher } from '@/components/layout/LanguageSwitcher'

export default function ApplyPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = use(params)
  const router = useRouter()
  const t = useTranslations('Apply')
  const locale = useLocale()
  const [form, setForm] = useState({ name: '', phone: '', email: '', position: '', store: '' })
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  const submit = async () => {
    if (!form.name.trim()) { setErr(t('nameRequired')); return }
    setBusy(true); setErr('')
    const res = await fetch('/api/hr/apply', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code, ...form }),
    })
    setBusy(false)
    const d = await res.json().catch(() => ({}))
    if (res.ok && d.token) router.replace(`/apply/edit/${d.token}`)
    else setErr(d.error ?? t('submitFailed'))
  }

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm({ ...form, [k]: e.target.value })

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc', display: 'flex', justifyContent: 'center', padding: '24px 16px' }}>
      <div style={{ width: '100%', maxWidth: 460 }}>
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
          <LanguageSwitcher currentLocale={locale} />
        </div>
        <div style={{ background: 'white', borderRadius: 16, padding: 24, boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
          <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>{t('applyTitle')}</h1>
          <p style={{ fontSize: 14, color: '#64748b', marginBottom: 20 }}>{t('applySubtitle')}</p>

          <div style={{ display: 'grid', gap: 12 }}>
            <F label={t('name')}><input style={inp} value={form.name} onChange={set('name')} /></F>
            <F label={t('phone')}><input style={inp} value={form.phone} onChange={set('phone')} /></F>
            <F label={t('email')}><input style={inp} type="email" value={form.email} onChange={set('email')} /></F>
            <F label={t('position')}><input style={inp} value={form.position} onChange={set('position')} /></F>
            <F label={t('store')}><input style={inp} value={form.store} onChange={set('store')} /></F>
          </div>

          {err && <p style={{ color: '#dc2626', fontSize: 13, marginTop: 12 }}>{err}</p>}

          <button onClick={submit} disabled={busy}
            style={{ marginTop: 20, width: '100%', height: 44, borderRadius: 10, border: 'none',
              background: busy ? '#94a3b8' : '#2563eb', color: 'white', fontSize: 15, fontWeight: 600, cursor: busy ? 'default' : 'pointer' }}>
            {busy ? t('submitting') : t('submit')}
          </button>
        </div>
      </div>
    </div>
  )
}

const inp: React.CSSProperties = {
  width: '100%', height: 40, borderRadius: 8, border: '1px solid #e2e8f0', padding: '0 12px', fontSize: 14, boxSizing: 'border-box',
}
function F({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: 'block' }}>
      <span style={{ display: 'block', fontSize: 13, color: '#475569', marginBottom: 4 }}>{label}</span>
      {children}
    </label>
  )
}
