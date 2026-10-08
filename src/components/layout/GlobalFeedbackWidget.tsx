'use client'

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import { MessageSquarePlus, X, Loader2, CheckCircle2 } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { createClient } from '@/lib/supabase/client'

type FbType = 'bug' | 'feature' | 'text_change' | 'ai_error'

const TYPE_OPTIONS: FbType[] = ['bug', 'ai_error', 'feature', 'text_change']

// 公開頁（未登入即可見）不顯示：訪客不需要、也無法對應到帳號/公司
const PUBLIC_PREFIXES = [
  '/login', '/register', '/auth', '/callback', '/book/', '/apply', '/payslip',
  '/vendor/', '/shift/', '/f/', '/geo/', '/esim', '/pos/kiosk',
]

// 全站任何模組（網頁版）都看得到的小型回報入口，取代原本完全沒有連結、
// 埋在 (tools)/feedback 底下沒人找得到的獨立頁面。送出時帶上目前所在路徑
// 當作 source，後端 /api/feedback 會一併記錄使用者當下所屬公司。
export function GlobalFeedbackWidget() {
  const t = useTranslations('Feedback')
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

  // 客服收件匣手機版底部固定回覆列跟這顆浮動按鈕會疊在同一個右下角，擋住送出鍵——
  // 手機寬度時把按鈕往上挪，桌機（有足夠邊距不會撞到）維持原位。
  const isCsInbox = pathname?.startsWith('/cs/inbox')

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
        const { feedback } = await res.json()
        // 免費項目（bug/ai_error，或公司被標記免計費）馬上觸發 AI 處理；
        // 計費項目這裡會被 /api/feedback/[id] 自己擋下（awaiting_approval），不用在前端先判斷。
        if (feedback?.id) {
          fetch(`/api/feedback/${feedback.id}`, { method: 'POST' }).catch(() => {})
        }
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
        title={t('title')}
        className={`fixed right-5 z-40 h-11 w-11 rounded-full shadow-lg flex items-center justify-center text-white hover:scale-105 transition-transform ${isCsInbox ? 'bottom-24 md:bottom-5' : 'bottom-5'}`}
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
              <h3 className="font-semibold text-sm">{t('title')}</h3>
              <button onClick={() => setOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X className="h-4 w-4" />
              </button>
            </div>

            {done ? (
              <div className="py-6 flex flex-col items-center gap-2 text-emerald-600">
                <CheckCircle2 className="h-6 w-6" />
                <p className="text-sm">{t('thanks')}</p>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-1.5">
                  {TYPE_OPTIONS.map(k => (
                    <button
                      key={k}
                      type="button"
                      onClick={() => setType(k)}
                      className={`text-xs px-2 py-1.5 rounded-lg border text-left transition-colors ${
                        type === k ? 'border-primary bg-primary/5 font-medium' : 'border-gray-200 text-gray-500 hover:bg-gray-50'
                      }`}
                    >
                      {t(`type.${k}`)}
                    </button>
                  ))}
                </div>
                <input
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  placeholder={t('titlePh')}
                  className="w-full h-9 px-3 rounded-lg border text-sm outline-none focus:ring-2"
                />
                <textarea
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  placeholder={t('descPh')}
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
                  {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : t('submit')}
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </>
  )
}
