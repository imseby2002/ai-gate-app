'use client'

import { useState } from 'react'
import { Loader2, User, Wallet, Shield, CheckCircle2 } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { createClient } from '@/lib/supabase/client'
import type { Profile } from '@/types/database'
import { CREDIT_PACKAGES, type PackageId } from '@/lib/ecpay/client'

interface SettingsFormProps {
  profile: Profile | null
  creditBalance: number
}

export function SettingsForm({ profile, creditBalance }: SettingsFormProps) {
  const t = useTranslations('Settings')
  const [fullName, setFullName] = useState(profile?.full_name ?? '')
  const [department, setDepartment] = useState(profile?.department ?? '')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [topupLoading, setTopupLoading] = useState<PackageId | null>(null)
  const [topupDone, setTopupDone] = useState(false)

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    const supabase = createClient()
    await supabase.from('profiles').update({ full_name: fullName, department }).eq('id', profile!.id)
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 3000)
  }

  const handleTopup = async (packageId: PackageId) => {
    setTopupLoading(packageId)
    try {
      const res = await fetch('/api/billing/create-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ packageId }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)

      const form = document.createElement('form')
      form.method = 'POST'
      form.action = data.paymentUrl
      form.target = '_blank'
      for (const [key, value] of Object.entries(data.params)) {
        const input = document.createElement('input')
        input.type = 'hidden'
        input.name = key
        input.value = String(value)
        form.appendChild(input)
      }
      document.body.appendChild(form)
      form.submit()
      document.body.removeChild(form)
      setTopupDone(true)
    } catch (err) {
      console.error('topup failed', err)
      alert('Error processing payment. Please try again.')
    } finally {
      setTopupLoading(null)
    }
  }

  if (typeof window !== 'undefined') {
    const params = new URLSearchParams(window.location.search)
    if (params.get('payment') === 'done' && !topupDone) setTopupDone(true)
  }

  const userTypeLabel = {
    employee: t('typeEmployee'),
    admin: t('typeAdmin'),
    external: t('typeExternal'),
  }[profile?.user_type ?? 'employee']

  return (
    <div className="max-w-2xl space-y-6">
      {/* Profile */}
      <div className="bg-white rounded-2xl border p-6 shadow-sm">
        <div className="flex items-center gap-2 mb-5">
          <User className="h-5 w-5 text-gray-400" />
          <h2 className="font-semibold">{t('profile')}</h2>
        </div>

        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1.5">{t('email')}</label>
            <input
              type="email"
              value={profile?.email ?? ''}
              disabled
              className="w-full h-10 px-3 rounded-lg border text-sm bg-gray-50 text-gray-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5">{t('fullName')}</label>
            <input
              type="text"
              value={fullName}
              onChange={e => setFullName(e.target.value)}
              className="w-full h-10 px-3 rounded-lg border text-sm outline-none focus:ring-2"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5">{t('department')}</label>
            <input
              type="text"
              value={department}
              onChange={e => setDepartment(e.target.value)}
              className="w-full h-10 px-3 rounded-lg border text-sm outline-none focus:ring-2"
              placeholder={t('departmentPlaceholder')}
            />
          </div>
          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={saving}
              className="flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-semibold text-white disabled:opacity-60"
              style={{ background: 'var(--primary)' }}
            >
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              {saving ? t('saving') : t('save')}
            </button>
            {saved && <span className="text-sm text-green-600">{t('saved')}</span>}
          </div>
        </form>
      </div>

      {/* Credit Balance & Top-up */}
      <div className="bg-white rounded-2xl border p-6 shadow-sm">
        <div className="flex items-center gap-2 mb-5">
          <Wallet className="h-5 w-5 text-gray-400" />
          <h2 className="font-semibold">{t('credits')}</h2>
        </div>

        {topupDone && (
          <div className="mb-4 flex items-center gap-2 p-3 rounded-xl bg-green-50 border border-green-200 text-green-700 text-sm">
            <CheckCircle2 className="h-4 w-4 flex-shrink-0" />
            {t('topupDoneMsg')}
          </div>
        )}

        {/* Balance */}
        <div className="flex items-center justify-between p-4 rounded-xl bg-gray-50 border mb-5">
          <div>
            <div className="text-sm text-gray-500">{t('currentBalance')}</div>
            <div className="text-2xl font-bold mt-0.5">
              ${creditBalance.toFixed(2)}
              <span className="text-base font-normal text-gray-400 ml-1">USD</span>
            </div>
          </div>
          <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ background: 'color-mix(in oklch, var(--primary) 15%, transparent)' }}>
            <Wallet className="h-5 w-5" style={{ color: 'var(--primary)' }} />
          </div>
        </div>

        {/* Packages */}
        <div className="mb-3 text-sm font-medium text-gray-600">{t('topupPackages')}</div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {CREDIT_PACKAGES.map(pkg => (
            <div
              key={pkg.id}
              className="relative rounded-xl border-2 p-4 flex flex-col gap-2"
              style={pkg.badge === '推薦' || pkg.badge === '最超值'
                ? { borderColor: 'var(--primary)', background: 'color-mix(in oklch, var(--primary) 5%, transparent)' }
                : { borderColor: '#e5e7eb' }
              }
            >
              {pkg.badge && (
                <span
                  className="absolute -top-2.5 left-3 px-2 py-0.5 rounded-full text-xs font-semibold text-white"
                  style={{ background: 'var(--primary)' }}
                >
                  {pkg.badge}
                </span>
              )}
              <div className="font-bold text-lg">{pkg.label}</div>
              <div className="text-sm text-gray-500">{pkg.desc}</div>
              <button
                onClick={() => handleTopup(pkg.id as PackageId)}
                disabled={topupLoading !== null}
                className="mt-auto flex items-center justify-center gap-1.5 w-full py-2 rounded-lg text-sm font-semibold text-white disabled:opacity-60"
                style={{ background: 'var(--primary)' }}
              >
                {topupLoading === pkg.id
                  ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> {t('topupProcessing')}</>
                  : t('topupNow')
                }
              </button>
            </div>
          ))}
        </div>
        <p className="mt-3 text-xs text-gray-400">{t('ecpayNote')}</p>
      </div>

      {/* Account Info */}
      <div className="bg-white rounded-2xl border p-6 shadow-sm">
        <div className="flex items-center gap-2 mb-3">
          <Shield className="h-5 w-5 text-gray-400" />
          <h2 className="font-semibold">{t('accountInfo')}</h2>
        </div>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between py-2 border-b">
            <span className="text-gray-500">{t('accountType')}</span>
            <span className="font-medium">{userTypeLabel}</span>
          </div>
          <div className="flex justify-between py-2">
            <span className="text-gray-500">{t('accountStatus')}</span>
            <span className={`font-medium ${profile?.is_active ? 'text-green-600' : 'text-red-600'}`}>
              {profile?.is_active ? t('active') : t('inactive')}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
