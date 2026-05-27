'use client'

import { useEffect, useState } from 'react'
import { Copy, Check, Link2, ExternalLink } from 'lucide-react'
import { SYSTEM_LIST } from '@/lib/systems'

export default function AdminLinksPage() {
  const [origin, setOrigin] = useState('')
  const [copied, setCopied] = useState('')

  useEffect(() => { setOrigin(window.location.origin) }, [])

  function copy(text: string, key: string) {
    navigator.clipboard.writeText(text)
    setCopied(key)
    setTimeout(() => setCopied(''), 2000)
  }

  return (
    <div className="max-w-3xl mx-auto px-6 py-8 space-y-6">
      <div className="flex items-center gap-2">
        <Link2 className="h-6 w-6 text-violet-500" />
        <div>
          <h1 className="text-xl font-bold">功能登入連結</h1>
          <p className="text-sm text-muted-foreground">把各功能的登入連結發給對應使用者；登入後僅能使用該功能。</p>
        </div>
      </div>

      <div className="space-y-3">
        {SYSTEM_LIST.map(s => {
          const loginUrl = `${origin}/login/${s.key}`
          return (
            <div key={s.key} className="bg-card rounded-2xl border p-5 shadow-sm">
              <div className="flex items-center justify-between gap-3 mb-2">
                <div>
                  <div className="font-semibold">{s.label}</div>
                  <div className="text-xs text-muted-foreground">{s.desc}</div>
                </div>
                <a href={loginUrl} target="_blank" rel="noreferrer"
                  className="shrink-0 text-muted-foreground hover:text-foreground" title="開啟登入頁">
                  <ExternalLink className="h-4 w-4" />
                </a>
              </div>
              <div className="flex items-center gap-2 bg-muted/40 rounded-lg px-3 py-2 border">
                <code className="flex-1 text-xs text-foreground/80 truncate">{loginUrl}</code>
                <button onClick={() => copy(loginUrl, s.key)}
                  className="shrink-0 inline-flex items-center gap-1 text-xs font-medium text-violet-600 hover:text-violet-700">
                  {copied === s.key ? <><Check className="h-3.5 w-3.5 text-green-500" /> 已複製</> : <><Copy className="h-3.5 w-3.5" /> 複製</>}
                </button>
              </div>
            </div>
          )
        })}
      </div>

      <div className="bg-violet-50 dark:bg-violet-950/30 border border-violet-200 dark:border-violet-900 rounded-xl p-4 text-sm text-violet-800 dark:text-violet-300">
        <p className="font-medium mb-1">說明</p>
        <ul className="list-disc pl-5 space-y-1 text-xs">
          <li>一般使用者從該功能連結登入後，只能使用該功能，看不到其他功能。</li>
          <li>使用者首次用 Email 登入會自動註冊（需收驗證信）；用 Google 則即時可用。</li>
          <li>此「全功能主登入頁」（{origin || ''}/login）只給管理者使用。</li>
        </ul>
      </div>
    </div>
  )
}
