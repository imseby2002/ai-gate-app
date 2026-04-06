'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Globe } from 'lucide-react'

const LANGUAGES = [
  { code: 'zh-TW', label: '繁中', flag: '🇹🇼' },
  { code: 'en',    label: 'EN',   flag: '🇺🇸' },
  { code: 'vi',    label: 'VI',   flag: '🇻🇳' },
]

interface LanguageSwitcherProps {
  currentLocale: string
}

export function LanguageSwitcher({ currentLocale }: LanguageSwitcherProps) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [, startTransition] = useTransition()

  const handleSelect = async (code: string) => {
    setOpen(false)
    await fetch('/api/locale', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ locale: code }),
    })
    startTransition(() => router.refresh())
  }

  const current = LANGUAGES.find(l => l.code === currentLocale) ?? LANGUAGES[0]

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-sm font-medium hover:bg-accent transition-colors"
        aria-label="Switch language"
      >
        <Globe className="h-3.5 w-3.5 text-muted-foreground" />
        <span>{current.flag} {current.label}</span>
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-1 w-36 rounded-lg border bg-popover shadow-md z-50 overflow-hidden">
            {LANGUAGES.map(lang => (
              <button
                key={lang.code}
                onClick={() => handleSelect(lang.code)}
                className={`flex items-center gap-2 w-full px-3 py-2 text-sm hover:bg-accent transition-colors ${
                  lang.code === currentLocale ? 'bg-accent font-medium' : ''
                }`}
              >
                <span>{lang.flag}</span>
                <span>{lang.label}</span>
                {lang.code === 'zh-TW' && <span className="text-xs text-muted-foreground ml-auto">繁體中文</span>}
                {lang.code === 'en' && <span className="text-xs text-muted-foreground ml-auto">English</span>}
                {lang.code === 'vi' && <span className="text-xs text-muted-foreground ml-auto">Tiếng Việt</span>}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
