'use client'

import { useState, useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { Zap, X } from 'lucide-react'

export function UpgradePlanBadge() {
  const pathname = usePathname()
  const [mounted, setMounted] = useState(false)
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    setMounted(true)
    try {
      const val = localStorage.getItem('cs_upgrade_badge_dismissed')
      if (val === 'true') {
        setDismissed(true)
      }
    } catch {
      // ignore
    }
  }, [])

  if (!mounted || !pathname?.startsWith('/cs')) return null

  if (dismissed) {
    return (
      <a
        href="/cs/plan"
        className="p-1.5 rounded-lg text-amber-500 hover:text-amber-600 hover:bg-amber-50 transition-colors"
        title="升級方案"
      >
        <Zap className="h-4 w-4 fill-current" />
      </a>
    )
  }

  return (
    <div className="flex items-center gap-1 bg-gradient-to-r from-blue-600 to-indigo-600 text-white pl-2.5 pr-1 py-1 rounded-full text-xs font-semibold shadow-sm hover:shadow transition-all">
      <a href="/cs/plan" className="flex items-center gap-1 hover:opacity-90 transition-opacity">
        <Zap className="h-3.5 w-3.5 fill-amber-300 text-amber-300 shrink-0" />
        <span className="shrink-0">升級方案</span>
      </a>
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault()
          e.stopPropagation()
          setDismissed(true)
          try {
            localStorage.setItem('cs_upgrade_badge_dismissed', 'true')
          } catch {}
        }}
        className="p-0.5 rounded-full hover:bg-white/20 text-white/80 hover:text-white transition-colors ml-0.5"
        title="關閉提示"
      >
        <X className="h-3 w-3" />
      </button>
    </div>
  )
}
