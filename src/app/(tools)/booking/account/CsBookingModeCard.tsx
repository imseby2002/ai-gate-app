'use client'
import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'

// 客服訂房模式（與「線上訂房」頁同一個設定：bnb_profiles.cs_booking_mode）
export default function CsBookingModeCard() {
  const t = useTranslations('Booking')
  const [csMode, setCsMode] = useState<'manual' | 'ai'>('manual')
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/booking/profile')
      .then(r => r.json())
      .then(d => setCsMode(d.profile?.cs_booking_mode === 'ai' ? 'ai' : 'manual'))
      .catch(() => {})
  }, [])

  async function changeCsMode(next: 'manual' | 'ai') {
    if (next === csMode) return
    const prev = csMode
    setCsMode(next)
    setSaving(true)
    setError(null)
    try {
      const res = await fetch('/api/booking/profile', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cs_booking_mode: next }),
      })
      if (!res.ok) { setCsMode(prev); setError(t('public.actionFailed')) }
    } catch {
      setCsMode(prev)
      setError(t('bookings.toast.networkError'))
    } finally { setSaving(false) }
  }

  return (
    <div className="bg-card rounded-2xl border p-6 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="font-semibold">{t('public.csModeLabel')}</h2>
          <p className="text-xs text-muted-foreground mt-1">
            {csMode === 'ai' ? t('public.csModeAiHint') : t('public.csModeManualHint')}
          </p>
        </div>
        <div className="flex shrink-0 rounded-lg border overflow-hidden text-xs">
          {(['manual', 'ai'] as const).map(m => (
            <button key={m} onClick={() => changeCsMode(m)} disabled={saving}
              className={`px-3 py-1.5 disabled:opacity-50 ${csMode === m ? 'bg-emerald-500 text-white' : 'bg-white text-gray-600'}`}>
              {m === 'ai' ? t('public.csModeAi') : t('public.csModeManual')}
            </button>
          ))}
        </div>
      </div>
      {error && <p className="text-xs text-red-600 mt-2">{error}</p>}
    </div>
  )
}
