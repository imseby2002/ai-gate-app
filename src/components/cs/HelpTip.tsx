'use client'

import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import { HelpCircle } from 'lucide-react'

interface Props {
  title: string
  children: React.ReactNode
  href?: string
}

// 站內「?」提示：點擊彈出白話文詳細說明，並可連到 /cs/help 對應章節看完整圖文教學。
export function HelpTip({ title, children, href }: Props) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    if (!open) return
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [open])

  return (
    <span ref={ref} className="relative inline-flex align-middle">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        aria-label={`說明：${title}`}
        className="inline-flex items-center justify-center h-4 w-4 rounded-full text-gray-400 hover:text-primary hover:bg-primary/10 transition-colors"
      >
        <HelpCircle className="h-3.5 w-3.5" />
      </button>
      {open && (
        <div className="absolute z-50 top-6 left-0 w-72 rounded-xl border bg-white shadow-lg p-3 text-left">
          <div className="text-xs font-semibold text-gray-800 mb-1">{title}</div>
          <div className="text-[11px] text-gray-500 leading-relaxed whitespace-pre-line">{children}</div>
          {href && (
            <Link
              href={href}
              target="_blank"
              className="mt-2 inline-block text-[11px] font-medium text-primary hover:underline"
              onClick={() => setOpen(false)}
            >
              查看完整圖文說明 →
            </Link>
          )}
        </div>
      )}
    </span>
  )
}
