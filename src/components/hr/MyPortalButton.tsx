'use client'

// 已綁定人事資料的 ERP 帳號：一鍵進自己的員工專區（班表、可上班時段、請假、薪資條、考試、個人資料）
import { useEffect, useState } from 'react'
import { useLocale } from 'next-intl'
import { IdCard } from 'lucide-react'

export function MyPortalButton() {
  const locale = useLocale()
  const [url, setUrl] = useState<string | null>(null)
  useEffect(() => {
    let alive = true
    fetch('/api/me/employee-portal').then(r => (r.ok ? r.json() : null)).then(d => { if (alive && d?.url) setUrl(d.url) }).catch(() => {})
    return () => { alive = false }
  }, [])
  if (!url) return null
  const label = locale === 'vi' ? 'Trang nhân viên của tôi' : locale === 'en' ? 'My employee page' : '我的員工專區'
  return (
    <a href={url} className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-full border border-indigo-300 bg-indigo-50 text-indigo-700 text-xs font-medium hover:bg-indigo-100">
      <IdCard className="h-3.5 w-3.5" />{label}
    </a>
  )
}
