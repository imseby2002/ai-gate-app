'use client'

import { useEffect, useState } from 'react'
import { ArrowLeft } from 'lucide-react'

// 返回「進來的那個模組」：優先用連結帶進來的 from（站內相對路徑），
// 其次用同源 referrer，最後退回 /apps（功能選單）。
function safePath(p: string | undefined | null): string | null {
  return p && p.startsWith('/') && !p.startsWith('//') && !p.startsWith('/credits') ? p : null
}

export function CreditsBack({ from }: { from?: string }) {
  const [target, setTarget] = useState<string>(safePath(from) ?? '/apps')

  useEffect(() => {
    if (safePath(from)) return
    try {
      const r = document.referrer
      if (r) {
        const u = new URL(r)
        if (u.origin === window.location.origin && !u.pathname.startsWith('/credits')) {
          setTarget(u.pathname + u.search)
        }
      }
    } catch { /* 保持預設 /apps */ }
  }, [from])

  return (
    <a href={target} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
      <ArrowLeft className="h-4 w-4" />
      返回
    </a>
  )
}
