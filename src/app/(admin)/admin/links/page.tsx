'use client'

import { useEffect, useState } from 'react'
import { Copy, Check, Link2, ExternalLink, Wrench, MessageCircle } from 'lucide-react'
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
          <h1 className="text-xl font-bold">功能登入與管理工具連結</h1>
          <p className="text-sm text-muted-foreground">集中管理各模組登入連結與後台專用外部工具，點擊即可開啟或複製網址。</p>
        </div>
      </div>

      {/* 外部管理與運營工具 */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Wrench className="h-4 w-4 text-emerald-600" />
          <h2 className="text-sm font-bold text-foreground">實用管理與運營工具</h2>
        </div>

        <div className="bg-gradient-to-r from-emerald-500/10 via-teal-500/10 to-transparent bg-card rounded-2xl border border-emerald-500/30 p-5 shadow-sm hover:border-emerald-500/60 transition-all">
          <div className="flex items-center justify-between gap-3 mb-2 flex-wrap">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-bold text-sm shadow-xs shrink-0">
                <MessageCircle className="h-5 w-5" />
              </div>
              <div>
                <div className="font-bold text-sm flex items-center gap-2">
                  <span>LINE ID 查詢工具 (Line ID Finder)</span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
                    客服常用
                  </span>
                </div>
                <div className="text-xs text-muted-foreground mt-0.5">快速查詢檢索 LINE 使用者 ID、群組 ID 與聊天室 ID，設定客服機器人專用。</div>
              </div>
            </div>
            <a
              href="https://cs.im-tourist.com/tools/line-id-finder"
              target="_blank"
              rel="noreferrer"
              className="shrink-0 inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs transition-colors cursor-pointer"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              開啟工具
            </a>
          </div>
          <div className="flex items-center gap-2 bg-muted/40 rounded-lg px-3 py-2 border mt-2">
            <code className="flex-1 text-xs text-foreground/80 truncate font-mono">https://cs.im-tourist.com/tools/line-id-finder</code>
            <button
              onClick={() => copy('https://cs.im-tourist.com/tools/line-id-finder', 'line-id-finder')}
              className="shrink-0 inline-flex items-center gap-1 text-xs font-semibold text-emerald-600 hover:text-emerald-700 cursor-pointer"
            >
              {copied === 'line-id-finder' ? <><Check className="h-3.5 w-3.5 text-green-500" /> 已複製</> : <><Copy className="h-3.5 w-3.5" /> 複製</>}
            </button>
          </div>
        </div>
      </div>

      <div className="pt-2 border-t">
        <h2 className="text-sm font-bold text-foreground mb-3">各模組獨立登入連結</h2>
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
