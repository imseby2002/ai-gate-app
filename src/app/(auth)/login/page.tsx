import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ArrowRight, Zap } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { SYSTEM_LIST } from '@/lib/systems'

export const dynamic = 'force-dynamic'

// 系統選擇頁（全功能主登入頁）：已登入者一律導回 /apps（功能選單）
export default async function LoginChooser({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const { error: authError } = await searchParams
  const supabase = await createClient()
  // 過期/失效的 refresh token（殘留的無效 session cookie）會讓 getUser() 拋出例外，
  // 沒有 try/catch 會直接讓這個 server component 掛掉；當作未登入處理即可。
  let user = null
  try {
    const { data } = await supabase.auth.getUser()
    user = data.user
  } catch { /* 視為未登入 */ }
  if (user) {
    redirect('/apps')
  }
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-50 px-4 py-10">
      <div className="w-full max-w-md">
        <div className="text-center mb-7">
          <div className="inline-flex items-center gap-2 mb-2">
            <Zap className="h-7 w-7" style={{ color: 'var(--primary)' }} />
            <span className="text-2xl font-bold">AI GATE</span>
          </div>
          <p className="text-gray-500 text-sm">請選擇要進入的系統</p>
        </div>

        {authError && (
          <div className="mb-4 p-3 rounded-lg text-sm text-red-700 bg-red-50 border border-red-200 text-center">
            Google 登入未完成，請重新登入一次；若持續發生請聯繫管理員。
          </div>
        )}

        <div className="space-y-2.5">
          {SYSTEM_LIST.map(s => (
            <Link key={s.key} href={`/login/${s.key}`}
              className="flex items-center justify-between gap-3 bg-white rounded-xl border p-4 hover:border-indigo-300 hover:shadow-sm transition-all group">
              <div className="min-w-0">
                <div className="font-semibold text-gray-900">{s.label}</div>
                <div className="text-xs text-gray-500 truncate">{s.desc}</div>
              </div>
              <ArrowRight className="h-4 w-4 text-gray-300 group-hover:text-indigo-500 shrink-0" />
            </Link>
          ))}
        </div>

        <p className="text-center text-xs text-gray-400 mt-6">登入後僅能使用該系統；切換請從另一系統的入口登入。</p>
      </div>
    </div>
  )
}
