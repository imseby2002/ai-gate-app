'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Globe } from 'lucide-react'

const LANGS = [
  { code: 'zh-TW', flag: '🇹🇼', label: '繁中' },
  { code: 'en', flag: '🇺🇸', label: 'EN' },
  { code: 'vi', flag: '🇻🇳', label: 'VI' },
] as const

export function KioskLangSwitcher({ currentLocale }: { currentLocale: string }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [, startTransition] = useTransition()
  const cur = LANGS.find(l => l.code === currentLocale) ?? LANGS[0]

  async function pick(code: string) {
    setOpen(false)
    localStorage.setItem('pos_locale', code)
    await fetch('/api/locale', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ locale: code }),
    })
    startTransition(() => router.refresh())
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1.5 text-sm font-medium text-white backdrop-blur hover:bg-white/25"
      >
        <Globe className="h-4 w-4" />
        {cur.flag} {cur.label}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full z-50 mt-1 w-36 overflow-hidden rounded-xl border bg-popover shadow-lg">
            {LANGS.map(l => (
              <button
                key={l.code}
                type="button"
                onClick={() => pick(l.code)}
                className={`flex w-full items-center gap-2 px-3 py-2.5 text-sm hover:bg-accent ${l.code === currentLocale ? 'bg-accent font-semibold' : ''}`}
              >
                <span>{l.flag}</span>
                <span>{l.label}</span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
