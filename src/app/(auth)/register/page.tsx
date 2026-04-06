'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Zap, Loader2 } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { createClient } from '@/lib/supabase/client'

export default function RegisterPage() {
  const router = useRouter()
  const t = useTranslations('Register')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [userType, setUserType] = useState<'employee' | 'external'>('employee')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    if (password.length < 6) {
      setError(t('errorPasswordShort'))
      return
    }
    setLoading(true)
    setError('')

    const supabase = createClient()
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName, user_type: userType },
      },
    })

    if (error) {
      setError(error.message)
      setLoading(false)
    } else {
      router.push('/dashboard')
      router.refresh()
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-50 px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 mb-2">
            <Zap className="h-8 w-8" style={{ color: 'var(--primary)' }} />
            <span className="text-3xl font-bold">AI GATE</span>
          </div>
          <p className="text-gray-600 text-sm">{t('subtitle')}</p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border p-8">
          <form onSubmit={handleRegister} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1.5">{t('fullName')}</label>
              <input
                type="text"
                value={fullName}
                onChange={e => setFullName(e.target.value)}
                required
                className="w-full h-10 px-3 rounded-lg border text-sm outline-none focus:ring-2 transition-all"
                placeholder={t('fullNamePlaceholder')}
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1.5">{t('email')}</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                className="w-full h-10 px-3 rounded-lg border text-sm outline-none focus:ring-2 transition-all"
                placeholder={t('emailPlaceholder')}
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1.5">{t('password')}</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                className="w-full h-10 px-3 rounded-lg border text-sm outline-none focus:ring-2 transition-all"
                placeholder={t('passwordPlaceholder')}
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1.5">{t('accountType')}</label>
              <div className="grid grid-cols-2 gap-2">
                {(['employee', 'external'] as const).map(type => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setUserType(type)}
                    className="h-10 rounded-lg border text-sm font-medium transition-all"
                    style={userType === type ? {
                      background: 'color-mix(in oklch, var(--primary) 10%, transparent)',
                      borderColor: 'var(--primary)',
                      color: 'var(--primary)',
                    } : {}}
                  >
                    {type === 'employee' ? t('employee') : t('external')}
                  </button>
                ))}
              </div>
            </div>

            {error && (
              <div className="p-3 rounded-lg text-sm text-red-700 bg-red-50 border border-red-200">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full h-10 rounded-lg text-sm font-semibold text-white flex items-center justify-center gap-2 disabled:opacity-60"
              style={{ background: 'var(--primary)' }}
            >
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              {loading ? t('submitting') : t('submit')}
            </button>
          </form>

          <p className="text-center text-sm text-gray-600 mt-6">
            {t('hasAccount')}{' '}
            <Link href="/login" className="font-medium" style={{ color: 'var(--primary)' }}>
              {t('login')}
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
