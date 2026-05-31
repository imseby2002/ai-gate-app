'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Loader2, ArrowRight } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { SYSTEMS, SCOPE_SESSION_KEY, type SystemKey } from '@/lib/systems'

function setScope(system: SystemKey) {
  // sessionStorage：每個分頁獨立，不跨分頁共用
  sessionStorage.setItem(SCOPE_SESSION_KEY, system)
  // 清除舊的 cookie（若有）
  document.cookie = 'ai_gate_scope=; path=/; max-age=0; samesite=lax'
}

export default function SystemAuth({ system }: { system: SystemKey }) {
  const def = SYSTEMS[system]
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')
  const [sessionEmail, setSessionEmail] = useState<string | null>(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const [allowed, setAllowed] = useState(true)
  const [checking, setChecking] = useState(true)

  useEffect(() => {
    const sb = createClient()
    sb.auth.getUser().then(async ({ data }) => {
      const u = data.user
      setSessionEmail(u?.email ?? null)
      if (u) {
        const { data: prof } = await sb.from('profiles').select('user_type, enabled_modules').eq('id', u.id).single()
        const admin = prof?.user_type === 'admin'
        setIsAdmin(admin)
        // 管理者不受限；enabled_modules 為空視為全開
        setAllowed(admin || !prof?.enabled_modules || prof.enabled_modules.includes(system))
      }
      setChecking(false)
    })
  }, [system])

  function enter() {
    if (!allowed) {
      setError(`您的帳號尚未開通「${def.label}」，請聯絡管理員開通後再使用。`)
      return
    }
    setScope(system)
    router.push(def.home)
    router.refresh()
  }

  // Email：先嘗試登入，查無帳號則自動註冊（登入即註冊）
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true); setError(''); setInfo('')
    const supabase = createClient()

    const signIn = await supabase.auth.signInWithPassword({ email, password })
    if (!signIn.error) { enter(); return }

    if (signIn.error.message === 'Invalid login credentials') {
      // 可能是未註冊 → 嘗試自動註冊
      const signUp = await supabase.auth.signUp({ email, password })
      if (signUp.error) {
        setError(signUp.error.message.includes('already registered')
          ? '密碼錯誤，請重新輸入'
          : signUp.error.message)
        setLoading(false)
        return
      }
      if (signUp.data.session) { enter(); return }
      // identities 為空代表 email 已存在（Supabase 防枚舉）→ 實為密碼錯誤
      if (signUp.data.user && (signUp.data.user.identities?.length ?? 0) === 0) {
        setError('密碼錯誤，請重新輸入')
        setLoading(false)
        return
      }
      // 需 email 驗證才能登入
      setInfo('已為您建立帳號！請到信箱點擊驗證信後，再回來用同一組 Email／密碼登入（沒收到請查看垃圾信匣）。想免驗證可改用上方 Google 登入。')
      setLoading(false)
      return
    }

    setError(signIn.error.message)
    setLoading(false)
  }

  async function handleGoogle() {
    setGoogleLoading(true); setError('')
    const supabase = createClient()
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/callback?system=${system}` },
    })
    if (error) { setError(error.message); setGoogleLoading(false) }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-50 px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-6">
          <div className="text-2xl font-bold">{def.label}</div>
          <p className="text-gray-500 text-sm mt-1">{def.desc}</p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border p-8">
          {checking ? (
            <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-gray-400" /></div>
          ) : sessionEmail ? (
            // 已登入 → 直接進入此系統（切換 scope）
            <div className="space-y-4 text-center">
              <p className="text-sm text-gray-600">目前登入：<span className="font-medium">{sessionEmail}</span></p>
              {allowed ? (
                <button onClick={enter}
                  className="w-full h-10 rounded-lg text-sm font-semibold text-white flex items-center justify-center gap-2"
                  style={{ background: 'var(--primary)' }}>
                  進入{def.label} <ArrowRight className="h-4 w-4" />
                </button>
              ) : (
                <div className="p-3 rounded-lg text-sm text-amber-700 bg-amber-50 border border-amber-200">
                  您的帳號尚未開通「{def.label}」，請聯絡管理員開通後再使用。
                </div>
              )}
              <button onClick={async () => { await createClient().auth.signOut(); setSessionEmail(null); setIsAdmin(false) }}
                className="text-xs text-gray-400 hover:text-gray-600">用其他帳號登入</button>
              {isAdmin && (
                <div><Link href="/login" className="text-xs text-gray-400 hover:text-gray-600">切換其他系統（管理者）</Link></div>
              )}
            </div>
          ) : (
            <>
              <button type="button" onClick={handleGoogle} disabled={googleLoading || loading}
                className="w-full h-10 rounded-lg border border-gray-200 text-sm font-medium flex items-center justify-center gap-2 hover:bg-gray-50 disabled:opacity-60 mb-4">
                {googleLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : (
                  <svg className="h-4 w-4" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                  </svg>
                )}
                使用 Google 繼續
              </button>

              <div className="relative mb-4">
                <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-gray-200" /></div>
                <div className="relative flex justify-center"><span className="bg-white px-3 text-xs text-gray-400">或用 Email</span></div>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1.5">Email</label>
                  <input type="email" value={email} onChange={e => setEmail(e.target.value)} required
                    className="w-full h-10 px-3 rounded-lg border text-sm outline-none focus:ring-2" placeholder="you@example.com" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1.5">密碼</label>
                  <input type="password" value={password} onChange={e => setPassword(e.target.value)} required minLength={6}
                    className="w-full h-10 px-3 rounded-lg border text-sm outline-none focus:ring-2" placeholder="至少 6 碼" />
                </div>
                {error && <div className="p-3 rounded-lg text-sm text-red-700 bg-red-50 border border-red-200">{error}</div>}
                {info && <div className="p-3 rounded-lg text-sm text-emerald-700 bg-emerald-50 border border-emerald-200">{info}</div>}
                <button type="submit" disabled={loading || googleLoading}
                  className="w-full h-10 rounded-lg text-sm font-semibold text-white flex items-center justify-center gap-2 disabled:opacity-60"
                  style={{ background: 'var(--primary)' }}>
                  {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                  {loading ? '處理中…' : '登入 / 註冊'}
                </button>
                <p className="text-center text-xs text-gray-400 leading-relaxed">首次使用 Email 會自動註冊，需到信箱點擊驗證信後才能登入。<br />想免驗證、立即進入，請用上方 Google 登入。</p>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
