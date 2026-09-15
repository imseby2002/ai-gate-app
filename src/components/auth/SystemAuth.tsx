'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Loader2, ArrowRight, KeyRound, ArrowLeft, Eye, EyeOff } from 'lucide-react'
import { useTranslations, useLocale } from 'next-intl'
import { createClient } from '@/lib/supabase/client'
import { getLocalizedSystemDef, SCOPE_SESSION_KEY, type SystemKey } from '@/lib/systems'
import { LanguageSwitcher } from '@/components/layout/LanguageSwitcher'

function setScope(system: SystemKey) {
  sessionStorage.setItem(SCOPE_SESSION_KEY, system)
  document.cookie = 'ai_gate_scope=; path=/; max-age=0; samesite=lax'
}

export default function SystemAuth({ system }: { system: SystemKey }) {
  const t = useTranslations('SystemAuth')
  const locale = useLocale()
  const def = getLocalizedSystemDef(system, locale)

  const [mode, setMode] = useState<'login' | 'forgot'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [resetLoading, setResetLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')
  const [sessionEmail, setSessionEmail] = useState<string | null>(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const [allowed, setAllowed] = useState(true)
  const [checking, setChecking] = useState(true)
  const [showPassword, setShowPassword] = useState(false)

  // 檢查並依使用者瀏覽器/系統語言 (navigator.language) 自動持久化 cookie
  useEffect(() => {
    if (typeof window !== 'undefined' && !document.cookie.includes('locale=')) {
      const navLang = (navigator.language || '').toLowerCase()
      let detected: 'vi' | 'en' | 'zh-TW' | null = null
      if (navLang.startsWith('vi')) detected = 'vi'
      else if (navLang.startsWith('en')) detected = 'en'
      else if (navLang.startsWith('zh')) detected = 'zh-TW'

      if (detected && detected !== locale) {
        const isImTourist = window.location.hostname.endsWith('im-tourist.com')
        const domainPart = isImTourist ? '; domain=.im-tourist.com' : ''
        document.cookie = `locale=${detected}; path=/${domainPart}; max-age=31536000; SameSite=Lax`
        window.location.reload()
      }
    }
  }, [locale])

  useEffect(() => {
    const sb = createClient()
    sb.auth.getUser().then(async ({ data }) => {
      const u = data.user
      setSessionEmail(u?.email ?? null)
      if (u) {
        const { data: prof } = await sb.from('profiles').select('user_type, enabled_modules').eq('id', u.id).single()
        const admin = prof?.user_type === 'admin'
        setIsAdmin(admin)
        setAllowed(admin || !prof?.enabled_modules || prof.enabled_modules.includes(system))
      }
      setChecking(false)
    }).catch(async () => {
      try { await sb.auth.signOut() } catch { /* ignore */ }
      setSessionEmail(null)
      setChecking(false)
    })
  }, [system])

  function enter() {
    if (!allowed) {
      setError(t('notAllowed', { name: def.label }))
      return
    }
    if (!isAdmin) setScope(system)
    // 用整頁導航而非 router.push()：同一個分頁若曾經在未登入狀態訪問過
    // def.home（例如 /apps），Next.js 的 client-side Router Cache 會把那次
    // 「被導回 /login」的結果快取住，之後 router.push 都直接命中舊快取，
    // 完全不會真的再問一次伺服器，導致登入後點「進入」又立刻被導回 /login。
    window.location.href = def.home
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true); setError(''); setInfo('')
    const supabase = createClient()

    const signIn = await supabase.auth.signInWithPassword({ email, password })
    if (!signIn.error) { enter(); return }

    if (signIn.error.message === 'Invalid login credentials') {
      const signUp = await supabase.auth.signUp({ 
        email, 
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/callback?system=${system}`
        }
      })
      if (signUp.error) {
        const rawMsg = (signUp.error.message || '').trim()
        const friendlyMsg = rawMsg.includes('already registered')
          ? t('passwordWrong')
          : rawMsg === '{}' || !rawMsg
          ? t('systemErrorFallback')
          : rawMsg
        setError(friendlyMsg)
        setLoading(false)
        return
      }
      if (signUp.data.session) { enter(); return }
      if (signUp.data.user && (signUp.data.user.identities?.length ?? 0) === 0) {
        setError(t('passwordWrong'))
        setLoading(false)
        return
      }
      setInfo(t('registeredCheckEmail'))
      setLoading(false)
      return
    }

    const rawMsg = (signIn.error.message || '').trim()
    setError(rawMsg === '{}' || !rawMsg ? t('loginErrorFallback') : rawMsg)
    setLoading(false)
  }

  async function handleGoogle() {
    setGoogleLoading(true); setError('')
    const supabase = createClient()
    const isImTourist = window.location.hostname.endsWith('im-tourist.com')
    document.cookie =
      `oauth_sys=${system}; path=/; max-age=600; samesite=lax` +
      (isImTourist ? '; domain=.im-tourist.com' : '')
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/callback` },
    })
    if (error) { setError(error.message); setGoogleLoading(false) }
  }

  async function handleForgotPassword(e: React.FormEvent) {
    e.preventDefault()
    if (!email.trim()) {
      setError(t('emailRequired'))
      return
    }
    setResetLoading(true)
    setError('')
    setInfo('')
    const supabase = createClient()
    // 注意：重設密碼信用的是 Supabase 的 hash-token（#access_token=...&type=recovery）
    // 格式，不是 OAuth 的 ?code= PKCE 格式，不能繞去 /callback——/callback 只認
    // ?code=，收到 recovery 連結時會找不到 code、直接把整個 hash 帶著導去 /login，
    // 而 /login（系統選擇頁）完全沒有建立 Supabase client，hash 裡的 token 就這樣
    // 被丟掉，使用者永遠卡在選單頁。必須直接導到 /reset-password，讓該頁自己的
    // Supabase client 處理 hash、建立 recovery session。
    const redirectUrl = `${window.location.origin}/reset-password?system=${system}`
    const { error: resetErr } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: redirectUrl,
    })
    setResetLoading(false)
    if (resetErr) {
      const rawMsg = (resetErr.message || '').trim()
      setError(rawMsg === '{}' || !rawMsg ? t('systemErrorFallback') : rawMsg)
      return
    }
    setInfo(t('resetEmailSent'))
  }

  return (
    <div className="min-h-screen relative flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-50 px-4 py-8">
      {/* 右上角語系切換器 */}
      <div className="absolute top-4 right-4 z-20">
        <LanguageSwitcher currentLocale={locale} />
      </div>

      <div className="w-full max-w-sm">
        <div className="text-center mb-6">
          <div className="text-2xl font-bold tracking-tight">{def.label}</div>
          <p className="text-gray-500 text-sm mt-1">{def.desc}</p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border p-8">
          {checking ? (
            <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-gray-400" /></div>
          ) : sessionEmail ? (
            <div className="space-y-4 text-center">
              <p className="text-sm text-gray-600">
                {t('currentlyLoggedIn')}<span className="font-medium">{sessionEmail}</span>
              </p>
              {allowed ? (
                <button onClick={enter}
                  className="w-full h-10 rounded-lg text-sm font-semibold text-white flex items-center justify-center gap-2"
                  style={{ background: 'var(--primary)' }}>
                  {t('enterSystem', { name: def.label })} <ArrowRight className="h-4 w-4" />
                </button>
              ) : (
                <div className="p-3 rounded-lg text-sm text-amber-700 bg-amber-50 border border-amber-200">
                  {t('notAllowed', { name: def.label })}
                </div>
              )}
              <button onClick={async () => { await createClient().auth.signOut(); setSessionEmail(null); setIsAdmin(false) }}
                className="text-xs text-gray-400 hover:text-gray-600">
                {t('useOtherAccount')}
              </button>
              {isAdmin && (
                <div>
                  <Link href="/login" className="text-xs text-gray-400 hover:text-gray-600">
                    {t('switchSystemAdmin')}
                  </Link>
                </div>
              )}
            </div>
          ) : mode === 'forgot' ? (
            <div className="space-y-4">
              <div className="text-center mb-2">
                <div className="h-10 w-10 mx-auto mb-2 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                  <KeyRound className="h-5 w-5" />
                </div>
                <h3 className="font-bold text-base text-gray-900">{t('resetPasswordTitle')}</h3>
                <p className="text-xs text-gray-500 mt-1 leading-relaxed">
                  {t('resetPasswordDesc')}
                </p>
              </div>

              <form onSubmit={handleForgotPassword} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1.5">{t('emailLabel')}</label>
                  <input
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    required
                    className="w-full h-10 px-3 rounded-lg border text-sm outline-none focus:ring-2"
                    placeholder={t('emailPlaceholder')}
                  />
                </div>

                {error && <div className="p-3 rounded-lg text-sm text-red-700 bg-red-50 border border-red-200">{error}</div>}
                {info && <div className="p-3 rounded-lg text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 leading-relaxed">{info}</div>}

                <button
                  type="submit"
                  disabled={resetLoading}
                  className="w-full h-10 rounded-lg text-sm font-semibold text-white flex items-center justify-center gap-2 disabled:opacity-60 cursor-pointer"
                  style={{ background: 'var(--primary)' }}
                >
                  {resetLoading && <Loader2 className="h-4 w-4 animate-spin" />}
                  {resetLoading ? t('sending') : t('sendResetEmailBtn')}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setMode('login')
                    setError('')
                    setInfo('')
                  }}
                  className="w-full text-center text-xs text-gray-500 hover:text-gray-800 font-medium py-1.5 transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                  <span>{t('backToLogin')}</span>
                </button>
              </form>
            </div>
          ) : (
            <>
              <button type="button" onClick={handleGoogle} disabled={googleLoading || loading}
                className="w-full h-10 rounded-lg border border-gray-200 text-sm font-medium flex items-center justify-center gap-2 hover:bg-gray-50 disabled:opacity-60 mb-4 transition-colors">
                {googleLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : (
                  <svg className="h-4 w-4" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                  </svg>
                )}
                {t('continueWithGoogle')}
              </button>

              <div className="relative mb-4">
                <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-gray-200" /></div>
                <div className="relative flex justify-center"><span className="bg-white px-3 text-xs text-gray-400">{t('orWithEmail')}</span></div>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1.5">{t('emailLabel')}</label>
                  <input type="email" value={email} onChange={e => setEmail(e.target.value)} required
                    className="w-full h-10 px-3 rounded-lg border text-sm outline-none focus:ring-2" placeholder={t('emailPlaceholder')} />
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-sm font-medium">{t('passwordLabel')}</label>
                    <button
                      type="button"
                      onClick={() => {
                        setMode('forgot')
                        setError('')
                        setInfo('')
                      }}
                      className="text-xs text-indigo-600 hover:text-indigo-800 hover:underline font-medium transition-colors cursor-pointer"
                    >
                      {t('forgotPassword')}
                    </button>
                  </div>
                  <div className="relative">
                    <input type={showPassword ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} required minLength={6}
                      className="w-full h-10 pl-3 pr-10 rounded-lg border text-sm outline-none focus:ring-2" placeholder={t('passwordPlaceholder')} />
                    <button type="button" onClick={() => setShowPassword(v => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
                {error && <div className="p-3 rounded-lg text-sm text-red-700 bg-red-50 border border-red-200">{error}</div>}
                {info && <div className="p-3 rounded-lg text-sm text-emerald-700 bg-emerald-50 border border-emerald-200">{info}</div>}
                <button type="submit" disabled={loading || googleLoading}
                  className="w-full h-10 rounded-lg text-sm font-semibold text-white flex items-center justify-center gap-2 disabled:opacity-60 cursor-pointer"
                  style={{ background: 'var(--primary)' }}>
                  {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                  {loading ? t('processing') : t('submitBtn')}
                </button>
                <div
                  className="text-center text-xs text-gray-400 leading-relaxed"
                  dangerouslySetInnerHTML={{ __html: t('footerHint') }}
                />
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
