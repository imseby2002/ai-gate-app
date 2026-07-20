'use client'

import { useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { LogOut, ChevronDown, Settings, Wallet } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

export function ToolsUserMenu({ displayName }: { displayName: string }) {
  const router = useRouter()
  const pathname = usePathname()
  // 儲值頁返回時要回到「進來的那個模組」，帶上目前路徑
  const creditsHref = `/credits?from=${encodeURIComponent(pathname || '/apps')}`
  const [open, setOpen] = useState(false)

  const handleSignOut = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-800 transition-colors cursor-pointer"
      >
        <span>{displayName}</span>
        <ChevronDown className={`h-3 w-3 transition-transform duration-150 ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-1 w-40 rounded-lg border bg-white shadow-md z-50 overflow-hidden py-1">
            <a
              href="/settings"
              className="flex items-center gap-2 w-full px-3 py-2 text-xs text-gray-700 hover:bg-gray-50 transition-colors"
            >
              <Settings className="h-3.5 w-3.5 text-gray-400" />
              帳號設定
            </a>
            <a
              href={creditsHref}
              className="flex items-center gap-2 w-full px-3 py-2 text-xs text-gray-700 hover:bg-gray-50 transition-colors"
            >
              <Wallet className="h-3.5 w-3.5 text-gray-400" />
              儲值點數
            </a>
            <div className="my-1 border-t" />
            <button
              onClick={handleSignOut}
              className="flex items-center gap-2 w-full px-3 py-2 text-xs text-red-600 hover:bg-red-50 transition-colors"
            >
              <LogOut className="h-3.5 w-3.5" />
              登出
            </button>
          </div>
        </>
      )}
    </div>
  )
}
