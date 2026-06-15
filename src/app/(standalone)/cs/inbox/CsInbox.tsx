'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslations, useLocale } from 'next-intl'
import Link from 'next/link'
import { ArrowLeft, RefreshCw, Loader2, Send, Bot, UserRound, Inbox, ChevronLeft } from 'lucide-react'

const PLATFORM_LABELS: Record<string, { name: string; emoji: string }> = {
  line:               { name: 'LINE',    emoji: '💬' },
  'line-oa':          { name: 'LINE',    emoji: '💬' },
  whatsapp:           { name: 'WhatsApp', emoji: '📱' },
  'whatsapp-biz':     { name: 'WhatsApp', emoji: '📱' },
  'whatsapp-personal':{ name: 'WhatsApp', emoji: '📱' },
  telegram:           { name: 'Telegram', emoji: '✈️' },
  zalo:               { name: 'Zalo',    emoji: '🔵' },
  'zalo-oa':          { name: 'Zalo',    emoji: '🔵' },
  wechat:             { name: 'WeChat',  emoji: '🟢' },
  test:               { name: 'Test',    emoji: '🧪' },
}
const plat = (p: string) => PLATFORM_LABELS[p] ?? { name: p, emoji: '🔗' }

interface Conversation {
  platform: string
  from_id: string
  name: string | null
  stage: string
  messageCount: number
  lastMessageAt: string
  takeover: boolean
}
interface Bubble {
  side: 'in' | 'out'
  sender: 'customer' | 'ai' | 'agent'
  text: string
  at: string
}

export function CsInbox({ initialIndustry }: { initialIndustry: string }) {
  const t = useTranslations('CsInbox')
  const locale = useLocale()
  const stageLabel = (s: string) => t.has(`stages.${s}`) ? t(`stages.${s}`) : ''
  const fmtTime = (ts: string) => {
    try { return new Date(ts).toLocaleString(locale, { timeZone: 'Asia/Taipei', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false }) }
    catch { return ts }
  }
  const fmtClock = (ts: string) => {
    try { return new Date(ts).toLocaleString(locale, { timeZone: 'Asia/Taipei', hour: '2-digit', minute: '2-digit', hour12: false }) }
    catch { return '' }
  }
  const industry = initialIndustry
  const [convos, setConvos] = useState<Conversation[]>([])
  const [loadingList, setLoadingList] = useState(true)
  const [active, setActive] = useState<Conversation | null>(null)
  const [bubbles, setBubbles] = useState<Bubble[]>([])
  const [takeover, setTakeover] = useState(false)
  const [loadingThread, setLoadingThread] = useState(false)
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  // ── 對話清單 ─────────────────────────────────────────────────────────────
  const loadList = useCallback(async () => {
    try {
      const res = await fetch(`/api/marketing/cs-thread?industry=${encodeURIComponent(industry)}`)
      const data = await res.json()
      setConvos(data.conversations ?? [])
    } catch { /* 保留現有清單 */ }
    finally { setLoadingList(false) }
  }, [industry])

  // ── 單一對話 thread ──────────────────────────────────────────────────────
  const loadThread = useCallback(async (c: Conversation, silent = false) => {
    if (!silent) setLoadingThread(true)
    try {
      const res = await fetch(`/api/marketing/cs-thread?industry=${encodeURIComponent(industry)}&platform=${encodeURIComponent(c.platform)}&to=${encodeURIComponent(c.from_id)}`)
      const data = await res.json()
      setBubbles(data.bubbles ?? [])
      setTakeover(!!data.takeover)
    } catch { /* ignore */ }
    finally { if (!silent) setLoadingThread(false) }
  }, [industry])

  useEffect(() => { loadList() }, [loadList])

  // 清單輪詢（8 秒）
  useEffect(() => {
    const t = setInterval(loadList, 8000)
    return () => clearInterval(t)
  }, [loadList])

  // 開啟中的對話輪詢（4 秒，靜默更新）
  useEffect(() => {
    if (!active) return
    const t = setInterval(() => loadThread(active, true), 4000)
    return () => clearInterval(t)
  }, [active, loadThread])

  // 新訊息自動捲到底
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [bubbles])

  const openConvo = (c: Conversation) => {
    setActive(c)
    setBubbles([])
    setErr(null)
    loadThread(c)
  }

  const send = async () => {
    const text = draft.trim()
    if (!text || !active || sending) return
    setSending(true)
    setErr(null)
    // 樂觀顯示
    const optimistic: Bubble = { side: 'out', sender: 'agent', text, at: new Date().toISOString() }
    setBubbles(prev => [...prev, optimistic])
    setDraft('')
    try {
      const res = await fetch('/api/marketing/cs-send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ platform: active.platform, to: active.from_id, text, industry }),
      })
      const data = await res.json()
      if (!res.ok) {
        setErr(data.error ?? t('sendFailed'))
        setBubbles(prev => prev.filter(b => b !== optimistic))
        setDraft(text)
      } else {
        setTakeover(true)
        loadThread(active, true)
      }
    } catch {
      setErr(t('networkError'))
      setBubbles(prev => prev.filter(b => b !== optimistic))
      setDraft(text)
    } finally {
      setSending(false)
    }
  }

  const toggleTakeover = async () => {
    if (!active) return
    const next = !takeover
    setTakeover(next)
    try {
      await fetch('/api/marketing/cs-takeover', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ platform: active.platform, to: active.from_id, industry, takeover: next }),
      })
      loadList()
    } catch {
      setTakeover(!next) // 還原
    }
  }

  return (
    <div className="h-[calc(100vh-0px)] min-h-full bg-slate-50/50 dark:bg-background">
      <div className="max-w-6xl mx-auto h-full flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between gap-3 px-4 sm:px-6 py-4 border-b bg-card/60">
          <div className="flex items-center gap-3">
            <Link href="/cs" className="text-muted-foreground hover:text-foreground"><ArrowLeft className="h-5 w-5" /></Link>
            <div className="flex items-center gap-2">
              <Inbox className="h-6 w-6 text-blue-500" />
              <h1 className="text-xl font-bold">{t('title')}</h1>
            </div>
          </div>
          <button onClick={() => { loadList(); if (active) loadThread(active) }}
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
            <RefreshCw className={`h-4 w-4 ${loadingList ? 'animate-spin' : ''}`} /> {t('refresh')}
          </button>
        </div>

        {/* Body: 雙欄 */}
        <div className="flex-1 min-h-0 flex">
          {/* 左：對話清單 */}
          <aside className={`${active ? 'hidden md:flex' : 'flex'} flex-col w-full md:w-80 border-r bg-card/40 shrink-0`}>
            <div className="flex-1 overflow-y-auto">
              {loadingList && convos.length === 0 ? (
                <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
              ) : convos.length === 0 ? (
                <div className="text-center py-16 px-6 text-muted-foreground text-sm">
                  {t('emptyList1')}<br />
                  <span className="text-xs">{t('emptyList2')}</span>
                </div>
              ) : convos.map(c => {
                const p = plat(c.platform)
                const isActive = active?.from_id === c.from_id && active?.platform === c.platform
                return (
                  <button key={`${c.platform}:${c.from_id}`} onClick={() => openConvo(c)}
                    className={`w-full text-left px-4 py-3 border-b hover:bg-accent/40 transition-colors ${isActive ? 'bg-accent/60' : ''}`}>
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-base shrink-0">{p.emoji}</span>
                        <span className="font-medium truncate">{c.name || c.from_id}</span>
                      </div>
                      <span className="text-[10px] text-muted-foreground whitespace-nowrap shrink-0">{fmtTime(c.lastMessageAt)}</span>
                    </div>
                    <div className="flex items-center gap-1.5 mt-1 pl-6">
                      <span className="text-[11px] text-muted-foreground">{p.name}</span>
                      {stageLabel(c.stage) && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground">{stageLabel(c.stage)}</span>
                      )}
                      {c.takeover && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400 inline-flex items-center gap-0.5">
                          <UserRound className="h-2.5 w-2.5" /> {t('humanTag')}
                        </span>
                      )}
                    </div>
                  </button>
                )
              })}
            </div>
          </aside>

          {/* 右：對話內容 */}
          <section className={`${active ? 'flex' : 'hidden md:flex'} flex-col flex-1 min-w-0`}>
            {!active ? (
              <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground gap-2">
                <Inbox className="h-10 w-10 opacity-30" />
                <p className="text-sm">{t('selectPrompt')}</p>
              </div>
            ) : (
              <>
                {/* 對話 header */}
                <div className="flex items-center justify-between gap-3 px-4 py-3 border-b bg-card/60">
                  <div className="flex items-center gap-2 min-w-0">
                    <button onClick={() => setActive(null)} className="md:hidden text-muted-foreground"><ChevronLeft className="h-5 w-5" /></button>
                    <span className="text-base">{plat(active.platform).emoji}</span>
                    <div className="min-w-0">
                      <div className="font-semibold truncate">{active.name || active.from_id}</div>
                      <div className="text-[11px] text-muted-foreground">{plat(active.platform).name} · {active.from_id}</div>
                    </div>
                  </div>
                  <button onClick={toggleTakeover}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors shrink-0 ${
                      takeover
                        ? 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-400'
                        : 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-400'
                    }`}>
                    {takeover ? <><UserRound className="h-3.5 w-3.5" /> {t('takeoverOn')}</> : <><Bot className="h-3.5 w-3.5" /> {t('aiAuto')}</>}
                  </button>
                </div>

                {/* 訊息串 */}
                <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
                  {loadingThread ? (
                    <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
                  ) : bubbles.length === 0 ? (
                    <div className="text-center py-16 text-muted-foreground text-sm">{t('noMessages')}</div>
                  ) : bubbles.map((b, i) => (
                    <div key={i} className={`flex ${b.side === 'out' ? 'justify-end' : 'justify-start'}`}>
                      <div className="max-w-[78%]">
                        {b.side === 'out' && (
                          <div className={`text-[10px] mb-0.5 text-right ${b.sender === 'agent' ? 'text-amber-600' : 'text-blue-500'}`}>
                            {b.sender === 'agent' ? t('agentLabel') : 'AI'}
                          </div>
                        )}
                        <div className={`rounded-2xl px-3.5 py-2 text-sm whitespace-pre-wrap break-words ${
                          b.side === 'in'
                            ? 'bg-card border rounded-tl-sm'
                            : b.sender === 'agent'
                              ? 'bg-amber-500 text-white rounded-tr-sm'
                              : 'bg-blue-500 text-white rounded-tr-sm'
                        }`}>
                          {b.text}
                        </div>
                        <div className={`text-[10px] text-muted-foreground mt-0.5 ${b.side === 'out' ? 'text-right' : ''}`}>{fmtClock(b.at)}</div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* 回覆框 */}
                <div className="border-t bg-card/60 px-3 py-3">
                  {err && <div className="text-xs text-rose-600 mb-2 px-1">{err}</div>}
                  {!takeover && (
                    <div className="text-[11px] text-muted-foreground mb-2 px-1">
                      {t('sendNote')}
                    </div>
                  )}
                  <div className="flex items-end gap-2">
                    <textarea
                      value={draft}
                      onChange={e => setDraft(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }}
                      placeholder={t('replyPlaceholder', { name: active.name || active.from_id })}
                      rows={1}
                      className="flex-1 resize-none rounded-xl border bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 max-h-32"
                    />
                    <button onClick={send} disabled={sending || !draft.trim()}
                      className="flex items-center justify-center h-10 w-10 rounded-xl bg-primary text-primary-foreground disabled:opacity-40 hover:opacity-90 transition-opacity shrink-0">
                      {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
              </>
            )}
          </section>
        </div>
      </div>
    </div>
  )
}
