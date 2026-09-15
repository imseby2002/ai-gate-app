'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Zap, KeyRound, Loader2, CheckCircle2, Eye, EyeOff, AlertCircle, ArrowRight } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { SYSTEMS, isSystemKey } from '@/lib/systems'

function ResetPasswordForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const system = searchParams.get('system') || searchParams.get('_si')

  const [checking, setChecking] = useState(true)
  const [hasSession, setHasSession] = useState(false)
  const [userEmail, setUserEmail] = useState<string | null>(null)

  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    const supabase = createClient()

    // 監聽 Auth 狀態（例如從 recovery link 進入觸發的 PASSWORD_RECOVERY 事件）
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (session?.user) {
        setHasSession(true)
        setUserEmail(session.user.email ?? null)
        setChecking(false)
      }
    })

    // 檢查現有 session
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) {
        setHasSession(true)
        setUserEmail(data.user.email ?? null)
      }
      setChecking(false)
    }).catch(() => {
      setChecking(false)
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (password.length < 6) {
      setError('新密碼長度至少需要 6 碼')
      return
    }

    if (password !== confirmPassword) {
      setError('兩次輸入的密碼不一致，請重新確認')
      return
    }

    setLoading(true)
    const supabase = createClient()
    const { error: updateErr } = await supabase.auth.updateUser({ password })
    setLoading(false)

    if (updateErr) {
      setError(updateErr.message || '更新密碼失敗，請稍後再試')
      return
    }

    setSuccess(true)

    // 決定成功後導向的目的地
    const sysKey = isSystemKey(system) ? system : null
    const targetHome = sysKey ? SYSTEMS[sysKey].home : '/apps'

    setTimeout(() => {
      router.push(targetHome)
      router.refresh()
    }, 1800)
  }

  const sysKey = isSystemKey(system) ? system : null
  const sysDef = sysKey ? SYSTEMS[sysKey] : null
  const loginUrl = sysKey ? `/login/${sysKey}` : '/login'

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-50 px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="text-center mb-6">
          <div className="inline-flex items-center gap-2 mb-1.5">
            <Zap className="h-6 w-6 text-indigo-600" />
            <span className="text-xl font-bold tracking-tight">AI GATE</span>
          </div>
          {sysDef ? (
            <div className="text-sm font-semibold text-gray-700">{sysDef.label} · 密碼重設</div>
          ) : (
            <div className="text-xs text-gray-500">帳號密碼重設中心</div>
          )}
        </div>

        <div className="bg-white rounded-2xl shadow-sm border p-8">
          {checking ? (
            <div className="py-10 text-center space-y-3">
              <Loader2 className="h-6 w-6 animate-spin text-indigo-600 mx-auto" />
              <p className="text-xs text-gray-500">正在驗證重設連結安全憑證...</p>
            </div>
          ) : success ? (
            <div className="py-6 text-center space-y-3">
              <div className="h-12 w-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto">
                <CheckCircle2 className="h-6 w-6" />
              </div>
              <h3 className="text-base font-bold text-gray-900">密碼重設成功！</h3>
              <p className="text-xs text-gray-500">
                新密碼已生效，即將自動引導您進入系統...
              </p>
              <div className="pt-2">
                <Loader2 className="h-4 w-4 animate-spin text-indigo-600 mx-auto" />
              </div>
            </div>
          ) : !hasSession ? (
            <div className="py-4 text-center space-y-4">
              <div className="h-12 w-12 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center mx-auto">
                <AlertCircle className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-gray-900">密碼重設連結已失效或過期</h3>
                <p className="text-xs text-gray-500 mt-1 leading-relaxed">
                  基於安全機制，密碼重設信件具有時效性且僅能使用一次。請重新至登入頁點擊「忘記密碼」再次發送申請。
                </p>
              </div>
              <Link
                href={loginUrl}
                className="inline-flex items-center justify-center gap-1.5 w-full h-10 rounded-lg text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 transition-colors"
              >
                <span>前往登入頁</span>
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          ) : (
            <div className="space-y-5">
              <div className="text-center">
                <div className="h-10 w-10 mx-auto mb-2.5 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                  <KeyRound className="h-5 w-5" />
                </div>
                <h3 className="font-bold text-base text-gray-900">設定新密碼</h3>
                {userEmail && (
                  <p className="text-xs text-gray-500 mt-0.5">
                    帳號：<span className="font-medium text-gray-700 font-mono">{userEmail}</span>
                  </p>
                )}
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1.5 text-gray-800">輸入新密碼</label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      required
                      minLength={6}
                      className="w-full h-10 pl-3 pr-10 rounded-lg border text-sm outline-none focus:ring-2 focus:ring-indigo-500 text-gray-900"
                      placeholder="至少 6 碼英文或數字"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1.5 text-gray-800">再次輸入新密碼</label>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={e => setConfirmPassword(e.target.value)}
                    required
                    minLength={6}
                    className="w-full h-10 px-3 rounded-lg border text-sm outline-none focus:ring-2 focus:ring-indigo-500 text-gray-900"
                    placeholder="請再次輸入相同新密碼"
                  />
                </div>

                {error && (
                  <div className="p-3 rounded-lg text-xs text-red-700 bg-red-50 border border-red-200">
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full h-10 rounded-lg text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 flex items-center justify-center gap-2 disabled:opacity-60 transition-colors shadow-xs cursor-pointer"
                >
                  {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                  {loading ? '正在更新密碼…' : '確認儲存新密碼'}
                </button>

                <div className="text-center pt-1">
                  <Link
                    href={loginUrl}
                    className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    放棄重設，返回登入頁
                  </Link>
                </div>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-50">
        <Loader2 className="h-6 w-6 animate-spin text-indigo-600" />
      </div>
    }>
      <ResetPasswordForm />
    </Suspense>
  )
}
