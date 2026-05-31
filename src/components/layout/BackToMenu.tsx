'use client'

import { useEffect, useState } from 'react'
import { Zap, ArrowLeft } from 'lucide-react'
import { SYSTEMS, SCOPE_SESSION_KEY, isSystemKey } from '@/lib/systems'

interface BackToMenuProps {
  isAdmin: boolean
  variant?: 'standalone' | 'tools'
}

export function BackToMenu({ isAdmin, variant = 'standalone' }: BackToMenuProps) {
  const [href, setHref] = useState('/dashboard')

  useEffect(() => {
    if (!isAdmin) {
      try {
        const scope = sessionStorage.getItem(SCOPE_SESSION_KEY)
        if (isSystemKey(scope)) setHref(SYSTEMS[scope].home)
      } catch {
        // sessionStorage 不可用（私密模式等），保持 /dashboard
      }
    }
  }, [isAdmin])

  if (variant === 'tools') {
    return (
      <a href={href} className="flex items-center gap-1.5 text-gray-500 hover:text-gray-800 text-sm transition-colors">
        <ArrowLeft className="h-3.5 w-3.5" />
        返回首頁
      </a>
    )
  }

  return (
    <a href={href} className="flex items-center gap-3 hover:opacity-80 transition-opacity">
      <Zap className="h-5 w-5 text-primary" />
      <div className="leading-none">
        <span className="font-bold text-base">AI GATE</span>
        <span className="block text-xs text-muted-foreground mt-0.5">← 返回主選單</span>
      </div>
    </a>
  )
}
