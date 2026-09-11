'use client'

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import { MessageSquarePlus, X, Loader2, CheckCircle2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

type FbType = 'bug' | 'feature' | 'text_change' | 'ai_error'

const TYPE_OPTIONS: { key: FbType; label: string }[] = [
  { key: 'bug', label: '🐛 錯誤回報' },
  { key: 'ai_error', label: '🤖 AI 回答錯誤' },
  { key: 'feature', label: '✨ 功能建議' },
  { key: 'text_change', label: '🎨 介面/文字調整' },
]

// 公開頁（未登入即可見）不顯示：訪客不需要、也無法對應到帳號/公司
const PUBLIC_PREFIXES = [
  '/login', '/register', '/auth', '/callback', '/book/', '/apply', '/payslip',
  '/vendor/', '/shift/', '/f/', '/geo/', '/esim', '/pos/kiosk',
]

// 全站任何模組（網頁版）都看得到的小型回報入口，取代原本完全沒有連結、
// 埋在 (tools)/feedback 底下沒人找得到的獨立頁面。送出時帶上目前所在路徑
// 當作 source，後端 /api/feedback 會一併記錄使用者當下所屬公司。
export function GlobalFeedbackWidget() {
  const pathname = usePathname()
  const [loggedIn, setLoggedIn] = useState(false)
  const [open, setOpen] = useState(false)
  const [type, setType] = useState<FbType>('bug')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)

  useEffect(() => {
    let cancelled = false
    createClient().auth.getUser().then(({ data }) => {
      if (!cancelled) setLoggedIn(!!data.user)
    }).catch(() => { /* 視為未登入，不顯示 */ })
    return () => { cancelled = true }
  }, [])

  const isPublicPage = PUBLIC_PREFIXES.some(p => pathname?.startsWith(p))
  if (!loggedIn || isPublicPage) return null

  async function submit() {
    if (!title.trim() || !description.trim()) return
    setSubmitting(true)
    try {
      const res = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: title.trim(), description: description.trim(), type, source: `web:${pathname}` }),
      })
      if (res.ok) {
        setDone(true)
        setTitle('')
        setDescription('')
        setType('bug')
        setTimeout(() => { setDone(false); setOpen(false) }, 1800)
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title="意見反映"
        className="fixed bottom-5 right-5 z-40 h-11 w-11 rounded-full shadow-lg flex items-center justify-center text-white hover:scale-105 transition-transform"
        style={{ background: 'var(--primary)' }}
      >
        <MessageSquarePlus className="h-5 w-5" />
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-4" onClick={() => setOpen(false)}>
          <div
            className="w-full max-w-sm bg-white dark:bg-card rounded-2xl border shadow-xl p-5 space-y-3"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-sm">意見反映</h3>
              <button onClick={() => setOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X className="h-4 w-4" />
              </button>
            </div>

            {done ? (
              <div className="py-6 flex flex-col items-center gap-2 text-emerald-600">
                <CheckCircle2 className="h-6 w-6" />
                <p className="text-sm">已送出，感謝回報！</p>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-1.5">
                  {TYPE_OPTIONS.map(t => (
                    <button
                      key={t.key}
                      type="button"
                      onClick={() => setType(t.key)}
                      className={`text-xs px-2 py-1.5 rounded-lg border text-left transition-colors ${
                        type === t.key ? 'border-primary bg-primary/5 font-medium' : 'border-gray-200 text-gray-500 hover:bg-gray-50'
                      }`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
                <input
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  placeholder="標題（簡短描述）"
                  className="w-full h-9 px-3 rounded-lg border text-sm outline-none focus:ring-2"
                />
                <textarea
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  placeholder="詳細說明發生了什麼、預期應該怎樣"
                  rows={4}
                  className="w-full px-3 py-2 rounded-lg border text-sm outline-none focus:ring-2 resize-none"
                />
                <button
                  type="button"
                  onClick={submit}
                  disabled={submitting || !title.trim() || !description.trim()}
                  className="w-full h-9 rounded-lg text-sm font-semibold text-white flex items-center justify-center gap-2 disabled:opacity-60"
                  style={{ background: 'var(--primary)' }}
                >
                  {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : '送出'}
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </>
  )
}
