'use client'
import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Menu, X } from 'lucide-react'

interface NavProfile {
  name: string
  theme_color?: string | null
  slug: string
}

const NAV_ITEMS = [
  { label: '首頁',    path: '' },
  { label: '房型',    path: '/rooms' },
  { label: '關於',    path: '/about' },
  { label: '聯絡',    path: '/contact' },
]

export default function BnbPublicNav({ profile }: { profile: NavProfile }) {
  const pathname  = usePathname()
  const accent    = profile.theme_color || '#4f46e5'
  const base      = `/book/${profile.slug}`
  const [open, setOpen] = useState(false)

  function isActive(path: string) {
    const full = base + path
    if (path === '') return pathname === base || pathname === base + '/'
    return pathname.startsWith(full)
  }

  return (
    <nav className="sticky top-0 z-50 bg-white/95 backdrop-blur border-b shadow-sm">
      <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between gap-4">
        <Link href={base} className="font-bold text-gray-900 text-sm truncate max-w-[140px] sm:max-w-xs">
          {profile.name}
        </Link>

        {/* Desktop */}
        <div className="hidden sm:flex items-center gap-0.5">
          {NAV_ITEMS.map(item => (
            <Link key={item.path} href={base + item.path}
              className={`px-3 py-1.5 rounded-lg text-sm transition-colors
                ${isActive(item.path)
                  ? 'font-semibold'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'}`}
              style={isActive(item.path) ? { color: accent } : undefined}>
              {item.label}
            </Link>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <Link href={`${base}/booking`}
            className="px-4 py-2 rounded-lg text-sm font-semibold text-white hover:opacity-90 transition-opacity"
            style={{ backgroundColor: accent }}>
            立即訂房
          </Link>
          <button onClick={() => setOpen(v => !v)}
            className="sm:hidden p-2 rounded-lg text-gray-500 hover:bg-gray-100">
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {/* Mobile dropdown */}
      {open && (
        <div className="sm:hidden border-t bg-white px-4 py-2 flex flex-col gap-0.5">
          {NAV_ITEMS.map(item => (
            <Link key={item.path} href={base + item.path} onClick={() => setOpen(false)}
              className={`px-3 py-2.5 rounded-xl text-sm transition-colors
                ${isActive(item.path)
                  ? 'font-semibold bg-gray-50'
                  : 'text-gray-600 hover:bg-gray-100'}`}
              style={isActive(item.path) ? { color: accent } : undefined}>
              {item.label}
            </Link>
          ))}
        </div>
      )}
    </nav>
  )
}
