'use client'

import { useState, useEffect } from 'react'
import { KeyRound, Loader2, CheckCircle2 } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { createClient } from '@/lib/supabase/client'

// 讓用 Google 登入的使用者也能加設 Email／密碼登入，兩種方式都能進同一個帳號。
// Supabase：已登入狀態下呼叫 updateUser({ password }) 直接對目前帳號設定密碼，
// 不需要驗證舊密碼（沿用現有 session 的授權），設定完成後該 email 就能額外用密碼登入。
export function PasswordSettings() {
  const t = useTranslations('Settings.pw')
  const [providers, setProviders] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const sb = createClient()
    sb.auth.getUser().then(({ data }) => {
      setProviders(data.user?.app_metadata?.providers ?? [])
      setLoading(false)
    })
  }, [])

  const hasPassword = providers.includes('email')
  const hasGoogle = providers.includes('google')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (password.length < 6) { setError(t('tooShort')); return }
    if (password !== confirm) { setError(t('mismatch')); return }
    setSaving(true)
    const supabase = createClient()
    const { error: err } = await supabase.auth.updateUser({ password })
    setSaving(false)
    if (err) { setError(err.message); return }
    setPassword(''); setConfirm('')
    setProviders(prev => (prev.includes('email') ? prev : [...prev, 'email']))
    setSaved(true)
    setTimeout(() => setSaved(false), 3000)
  }

  if (loading) return null

  return (
    <div className="bg-card rounded-2xl border p-6 shadow-sm">
      <div className="flex items-center gap-2 mb-2">
        <KeyRound className="h-5 w-5 text-muted-foreground" />
        <h2 className="font-semibold">{t('title')}</h2>
      </div>
      <p className="text-xs text-muted-foreground mb-5">
        {hasPassword
          ? (hasGoogle ? t('descHasBoth') : t('descHasPw'))
          : hasGoogle
            ? t('descGoogle')
            : t('descNone')}
      </p>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1.5">{hasPassword ? t('newPw') : t('setPw')}</label>
          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            minLength={6}
            className="w-full h-10 px-3 rounded-lg border text-sm outline-none focus:ring-2 bg-background"
            placeholder={t('minPh')}
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1.5">{t('confirm')}</label>
          <input
            type="password"
            value={confirm}
            onChange={e => setConfirm(e.target.value)}
            minLength={6}
            className="w-full h-10 px-3 rounded-lg border text-sm outline-none focus:ring-2 bg-background"
            placeholder={t('againPh')}
          />
        </div>
        {error && <div className="p-3 rounded-lg text-sm text-red-700 bg-red-50 border border-red-200">{error}</div>}
        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={saving || !password || !confirm}
            className="flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-semibold text-white disabled:opacity-60"
            style={{ background: 'var(--primary)' }}
          >
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            {saving ? t('saving') : hasPassword ? t('update') : t('setPw')}
          </button>
          {saved && (
            <span className="flex items-center gap-1 text-sm text-green-600">
              <CheckCircle2 className="h-4 w-4" />{t('done')}
            </span>
          )}
        </div>
      </form>
    </div>
  )
}
