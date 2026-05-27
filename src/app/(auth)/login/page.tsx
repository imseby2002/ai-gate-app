import Link from 'next/link'
import { ArrowRight, Zap } from 'lucide-react'
import { SYSTEM_LIST } from '@/lib/systems'

// 系統選擇頁：每個系統各自獨立登入/註冊入口
export default function LoginChooser() {
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
