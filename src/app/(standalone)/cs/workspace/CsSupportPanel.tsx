'use client'

import { useState } from 'react'
import Link from 'next/link'
import { LifeBuoy, Wrench, MessageSquareWarning, Send, Check, Loader2, ChevronRight } from 'lucide-react'

type RequestType = 'feature' | 'feedback'

const PANEL_META: Record<RequestType, { icon: typeof Wrench; title: string; placeholder: string }> = {
  feature: { icon: Wrench, title: '客製功能需求', placeholder: '想新增什麼功能？（基礎客製需審核，複雜功能將另議建置費+月維護費）' },
  feedback: { icon: MessageSquareWarning, title: '問題反映', placeholder: '遇到什麼問題？（bug、操作困惑、建議都歡迎）' },
}

export function CsSupportPanel() {
  const [open, setOpen] = useState<RequestType | null>(null)
  const [contact, setContact] = useState('')
  const [note, setNote] = useState('')
  const [sending, setSending] = useState(false)
  const [sentType, setSentType] = useState<RequestType | null>(null)
  const [priceUsd, setPriceUsd] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)

  const openPanel = (type: RequestType) => {
    setOpen(type); setSentType(null); setError(null); setContact(''); setNote('')
  }

  const submit = async (type: RequestType) => {
    if (!note.trim()) { setError('請填寫需求說明'); return }
    setSending(true); setError(null)
    try {
      const res = await fetch('/api/marketing/cs-support-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, contact, note }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? '送出失敗，請稍後再試'); return }
      setSentType(type)
      setPriceUsd(data.priceUsd ?? null)
    } catch {
      setError('網路錯誤，請稍後再試')
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="bg-card border rounded-xl p-4 space-y-3">
      <div className="font-medium text-sm text-foreground flex items-center gap-2">
        <LifeBuoy className="h-4 w-4 text-primary" />需要協助？
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        <Link href="/cs/settings"
          className="flex items-center gap-2 px-3 py-2.5 rounded-lg border hover:bg-accent transition-colors text-sm">
          <LifeBuoy className="h-4 w-4 text-muted-foreground shrink-0" />
          <span className="flex-1">協助設定</span>
          <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/40" />
        </Link>
        <button onClick={() => openPanel('feature')}
          className="flex items-center gap-2 px-3 py-2.5 rounded-lg border hover:bg-accent transition-colors text-sm text-left">
          <Wrench className="h-4 w-4 text-muted-foreground shrink-0" />
          <span className="flex-1">客製功能需求</span>
          <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/40" />
        </button>
        <button onClick={() => openPanel('feedback')}
          className="flex items-center gap-2 px-3 py-2.5 rounded-lg border hover:bg-accent transition-colors text-sm text-left">
          <MessageSquareWarning className="h-4 w-4 text-muted-foreground shrink-0" />
          <span className="flex-1">問題反映</span>
          <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/40" />
        </button>
      </div>

      {open && (
        <div className="rounded-lg border bg-muted/30 p-3 space-y-2.5">
          {sentType === open ? (
            <div className="flex items-center gap-2 text-sm text-emerald-600 dark:text-emerald-400">
              <Check className="h-4 w-4" />
              已送出，我們會盡快回覆您。
              {priceUsd != null && `（基礎客製參考價 $${priceUsd} 美元/次，實際費用需審核後確認）`}
            </div>
          ) : (
            <>
              <div className="flex items-center gap-2 text-sm font-medium">
                {(() => { const Icon = PANEL_META[open].icon; return <Icon className="h-4 w-4 text-primary" /> })()}
                {PANEL_META[open].title}
              </div>
              <input
                value={contact}
                onChange={e => setContact(e.target.value)}
                placeholder="聯絡方式（電話 / LINE ID，選填）"
                className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
              <textarea
                value={note}
                onChange={e => setNote(e.target.value)}
                placeholder={PANEL_META[open].placeholder}
                rows={3}
                className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
              <div className="flex items-center gap-2">
                <button onClick={() => submit(open)} disabled={sending}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium disabled:opacity-50 hover:opacity-90 transition-opacity">
                  {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  送出
                </button>
                <button onClick={() => setOpen(null)} className="px-3 py-2 text-sm text-muted-foreground hover:text-foreground">
                  取消
                </button>
              </div>
              {error && <p className="text-xs text-red-500">{error}</p>}
            </>
          )}
        </div>
      )}
    </div>
  )
}
