import Link from 'next/link'
import { ArrowRight, Zap } from 'lucide-react'
import { getLocale } from 'next-intl/server'
import { getLocalizedSystems, type SystemDef } from '@/lib/systems'
import { LanguageSwitcher } from '@/components/layout/LanguageSwitcher'
import { AutoRedirectIfAuthed } from '@/components/auth/AutoRedirectIfAuthed'

export const dynamic = 'force-dynamic'

// 系統選擇頁（全功能主登入頁）：已登入者一律導回 /apps（功能選單）
export default async function LoginChooser({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const { error: authError } = await searchParams

  const locale = await getLocale()
  const systems: SystemDef[] = Object.values(getLocalizedSystems(locale))

  const titleDesc = locale === 'vi'
    ? 'Vui lòng chọn hệ thống để đăng nhập'
    : locale === 'en'
    ? 'Please select a system to enter'
    : '請選擇要進入的系統'

  const authErrorText = locale === 'vi'
    ? 'Đăng nhập Google chưa hoàn tất, vui lòng thử lại; nếu tiếp tục bị lỗi vui lòng liên hệ quản trị viên.'
    : locale === 'en'
    ? 'Google sign-in was not completed, please try again or contact the administrator.'
    : 'Google 登入未完成，請重新登入一次；若持續發生請聯繫管理員。'

  const footerHint = locale === 'vi'
    ? 'Sau khi đăng nhập chỉ sử dụng được hệ thống đó; để chuyển hệ thống vui lòng đăng nhập qua cổng tương ứng.'
    : locale === 'en'
    ? 'Access is scoped to the selected system; switch by logging in from another portal.'
    : '登入後僅能使用該系統；切換請從另一系統的入口登入。'

  return (
    <div className="min-h-screen relative flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-50 px-4 py-10">
      <AutoRedirectIfAuthed />
      <div className="absolute top-4 right-4 z-20">
        <LanguageSwitcher currentLocale={locale} />
      </div>

      <div className="w-full max-w-md">
        <div className="text-center mb-7">
          <div className="inline-flex items-center gap-2 mb-2">
            <Zap className="h-7 w-7" style={{ color: 'var(--primary)' }} />
            <span className="text-2xl font-bold">AI GATE</span>
          </div>
          <p className="text-gray-500 text-sm">{titleDesc}</p>
        </div>

        {authError && (
          <div className="mb-4 p-3 rounded-lg text-sm text-red-700 bg-red-50 border border-red-200 text-center">
            {authErrorText}
          </div>
        )}

        <div className="space-y-2.5">
          {systems.map(s => (
            <Link key={s.key} href={`/login/${s.key}`} prefetch={false}
              className="flex items-center justify-between gap-3 bg-white rounded-xl border p-4 hover:border-indigo-300 hover:shadow-sm transition-all group">
              <div className="min-w-0">
                <div className="font-semibold text-gray-900">{s.label}</div>
                <div className="text-xs text-gray-500 truncate">{s.desc}</div>
              </div>
              <ArrowRight className="h-4 w-4 text-gray-300 group-hover:text-indigo-500 shrink-0" />
            </Link>
          ))}
        </div>

        <p className="text-center text-xs text-gray-400 mt-6">{footerHint}</p>
      </div>
    </div>
  )
}
