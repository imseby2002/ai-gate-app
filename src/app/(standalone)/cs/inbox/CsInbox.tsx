'use client'

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { useTranslations, useLocale } from 'next-intl'
import Link from 'next/link'
import { ArrowLeft, RefreshCw, Loader2, Send, Bot, UserRound, Inbox, ChevronLeft, Search, X, ImagePlus } from 'lucide-react'
import { uploadInboxImage, formatBubbleTime } from '@/lib/cs/resize-image'
import { splitBubbleImages } from '@/lib/cs/bubble-images'
import { InstallInboxButton } from './InstallInboxButton'

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

// 把搜尋字詞在文字中標黃
function highlight(text: string, q: string) {
  if (!q) return text
  const lower = text.toLowerCase()
  const needle = q.toLowerCase()
  const parts: ReactNode[] = []
  let from = 0
  for (let i = lower.indexOf(needle); i >= 0; i = lower.indexOf(needle, from)) {
    if (i > from) parts.push(text.slice(from, i))
    parts.push(<mark key={i} className="bg-yellow-200 text-gray-900 rounded-sm">{text.slice(i, i + q.length)}</mark>)
    from = i + q.length
  }
  if (!parts.length) return text
  parts.push(text.slice(from))
  return parts
}

function formatCustomerName(name: string | null | undefined, fromId: string, t: (key: string, values?: Record<string, string>) => string): string {
  if (name && name.trim()) return name.trim()
  if (fromId.startsWith('U') && fromId.length === 33) {
    return t('lineCustomerFallback', { id: fromId.slice(1, 6) })
  }
  return fromId
}

interface Conversation {
  platform: string
  from_id: string
  name: string | null
  stage: string
  messageCount: number
  lastMessageAt: string
  takeover: boolean
  match?: string | null
  matchAt?: string | null
  preview?: string | null
  alert?: { intents: string[]; ticketIds: string[]; notes?: string[] } | null
}
interface ThreadExtras {
  alert: { intents: string[]; ticketIds: string[]; notes?: string[] } | null
  booking: { id: string; guestName: string | null; checkIn: string; checkOut: string; room: string | null; guests: number | null; orderNo: string | null } | null
  reservation: { id: string; appointmentNo: string; startTime: string; service: string | null; staff: string | null; store: string | null; statusLabel: string } | null
  crmContactId: string | null
}
const MANUAL_FLAG_INTENT = '人工標記待處理'
interface Bubble {
  side: 'in' | 'out'
  sender: 'customer' | 'ai' | 'agent'
  text: string
  at: string
  image?: string
}

export function CsInbox({ initialIndustry, initialTarget }: { initialIndustry: string; initialTarget?: { platform: string; from_id: string } | null }) {
  const t = useTranslations('CsInbox')
  const locale = useLocale()
  const fmtTime = (ts: string) => {
    try {
      const d = new Date(ts)
      const tz = 'Asia/Taipei'
      const day = (x: Date) => x.toLocaleDateString('sv-SE', { timeZone: tz })
      return day(d) === day(new Date())
        ? d.toLocaleTimeString(locale, { timeZone: tz, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
        : d.toLocaleDateString(locale, { timeZone: tz, month: 'numeric', day: 'numeric' })
    } catch { return ts }
  }
  const fmtClock = (ts: string) => formatBubbleTime(ts, locale)
  const industry = initialIndustry
  const [convos, setConvos] = useState<Conversation[]>([])
  const [loadingList, setLoadingList] = useState(true)
  const [active, setActive] = useState<Conversation | null>(null)
  const [bubbles, setBubbles] = useState<Bubble[]>([])
  const [takeover, setTakeover] = useState(false)
  const [customerSummary, setCustomerSummary] = useState<string | null>(null)
  const [loadingThread, setLoadingThread] = useState(false)
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const imageInputRef = useRef<HTMLInputElement>(null)
  const [err, setErr] = useState<string | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  // 搜尋：客戶名稱／ID 或過往對話內容
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchInput, setSearchInput] = useState('')
  const [searchQ, setSearchQ] = useState('')
  const scrollToHit = useRef(false)
  // 對話預設只載入最新 300 則；更早的用「載入更早的訊息」往前補
  const [hasOlder, setHasOlder] = useState(false)
  const [hasNewer, setHasNewer] = useState(false)
  const [loadingOlder, setLoadingOlder] = useState(false)
  // 與桌面版收件匣一致：需要真人提醒、標記需處理、訂房／預約資訊、客戶檔案連結
  const [extras, setExtras] = useState<ThreadExtras | null>(null)
  const [summaryOpen, setSummaryOpen] = useState(false)
  const [flagBusy, setFlagBusy] = useState(false)
  // 加到常見問答：點回覆下方的小圖示開一個精簡的底部面板
  const [faq, setFaq] = useState<{ q: string; a: string; saving: boolean; done: boolean } | null>(null)
  const saveFaq = async () => {
    if (!faq || !faq.a.trim() || faq.saving) return
    setFaq({ ...faq, saving: true })
    try {
      const res = await fetch('/api/marketing/cs-faq', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ q: faq.q, a: faq.a, keywords: [], industry, autoSuggest: true, context: faq.q }),
      })
      if (!res.ok) throw new Error()
      setFaq(f => f ? { ...f, saving: false, done: true } : f)
      setTimeout(() => setFaq(null), 900)
    } catch {
      setFaq(f => f ? { ...f, saving: false } : f)
    }
  }
  const prevScrollHeight = useRef<number | null>(null)
  useEffect(() => {
    const id = setTimeout(() => setSearchQ(searchInput.trim()), 400)
    return () => clearTimeout(id)
  }, [searchInput])
  // 員工在輸入框打字時節流通知後端（每 15 秒最多一次），讓 AI 在打字期間不插話；
  // 停止打字／回覆後閒置超過設定分鐘數，AI 自動接回（見 lib/cs/handoff.ts）。
  const lastTypingPing = useRef(0)
  // 客服是否目前捲動在接近底部——只有在這裡才自動捲到底。沒有這個判斷，手機版每 4 秒
  // 的靜默輪詢（loadThread silent）都會產生一組新的 bubbles 陣列（即使內容沒變），
  // 觸發下面的自動捲動 effect，把正在往上滑看歷史訊息的客服硬拉回最底部，完全沒辦法
  // 慢慢看內容（真實案例：客服反映「往上滑一看就馬上被拉下來」）。
  const nearBottomRef = useRef(true)

  // ── 對話清單 ─────────────────────────────────────────────────────────────
  const loadList = useCallback(async () => {
    try {
      const qs = searchQ ? `&q=${encodeURIComponent(searchQ)}` : ''
      const res = await fetch(`/api/marketing/cs-thread?industry=${encodeURIComponent(industry)}${qs}`)
      const data = await res.json()
      setConvos(data.conversations ?? [])
    } catch { /* 保留現有清單 */ }
    finally { setLoadingList(false) }
  }, [industry, searchQ])

  // ── 單一對話 thread ──────────────────────────────────────────────────────
  const threadUrl = useCallback((c: Conversation) =>
    `/api/marketing/cs-thread?industry=${encodeURIComponent(industry)}&platform=${encodeURIComponent(c.platform)}&to=${encodeURIComponent(c.from_id)}`, [industry])

  // around：從搜尋結果開啟時，載入符合訊息的前後一段
  // 目前開啟的對話；切換對話後，還在路上的舊對話回應一律丟掉。
  // 真實案例：切到陳倩芬的對話，畫面卻顯示另一位客人林秀嬫的訊息（舊對話的輪詢回應晚到，蓋掉新對話）。
  const activeKeyRef = useRef<string | null>(null)
  const convoKey = (c: Conversation) => `${c.platform}:${c.from_id}`

  const loadThread = useCallback(async (c: Conversation, silent = false, around?: string | null) => {
    if (!silent) setLoadingThread(true)
    try {
      const res = await fetch(threadUrl(c) + (around ? `&around=${encodeURIComponent(around)}` : '') + (silent ? '&lite=1' : ''))
      const data = await res.json()
      if (activeKeyRef.current !== `${c.platform}:${c.from_id}`) return
      const fresh: Bubble[] = data.bubbles ?? []
      if (silent) {
        // 輪詢只更新最新那一段，保留已往前載入的更早訊息
        setBubbles(prev => {
          const first = fresh[0]?.at
          return first ? [...prev.filter(b => b.at < first), ...fresh] : fresh
        })
      } else {
        setBubbles(fresh)
        setHasOlder(!!data.hasOlder)
        setHasNewer(!!data.hasNewer)
      }
      setTakeover(!!data.takeover)
      setCustomerSummary(data.summary ?? null)
      setExtras(prev => ({
        alert: data.alert ?? null,
        // 輪詢時伺服器仍會回傳訂房／預約；回傳缺少時保留上一次的
        booking: data.booking !== undefined ? data.booking : prev?.booking ?? null,
        reservation: data.reservation !== undefined ? data.reservation : prev?.reservation ?? null,
        crmContactId: data.crmContactId !== undefined ? data.crmContactId : prev?.crmContactId ?? null,
      }))
      setConvos(prev => prev.map(x => x.platform === c.platform && x.from_id === c.from_id ? { ...x, alert: data.alert ?? null } : x))
    } catch { /* ignore */ }
    finally { if (!silent) setLoadingThread(false) }
  }, [threadUrl])

  const loadOlder = async () => {
    if (!active || !bubbles.length || loadingOlder) return
    setLoadingOlder(true)
    try {
      const res = await fetch(threadUrl(active) + `&before=${encodeURIComponent(bubbles[0].at)}`)
      const data = await res.json()
      if (activeKeyRef.current !== convoKey(active)) return
      const older: Bubble[] = data.bubbles ?? []
      nearBottomRef.current = false
      prevScrollHeight.current = scrollRef.current?.scrollHeight ?? null
      setBubbles(prev => [...older, ...prev])
      setHasOlder(!!data.hasOlder)
    } catch { /* ignore */ }
    finally { setLoadingOlder(false) }
  }

  useEffect(() => { loadList() }, [loadList])

  // 清單輪詢（8 秒）
  useEffect(() => {
    const t = setInterval(loadList, 8000)
    return () => clearInterval(t)
  }, [loadList])

  // 開啟中的對話輪詢（4 秒，靜默更新）
  // 從搜尋結果開啟、畫面不在最新訊息時不輪詢，避免把畫面換回最新一段
  useEffect(() => {
    if (!active || hasNewer) return
    const t = setInterval(() => loadThread(active, true), 4000)
    return () => clearInterval(t)
  }, [active, hasNewer, loadThread])

  // 新訊息自動捲到底——只有客服本來就在底部附近（正在看最新訊息）才自動跟著捲，
  // 已經往上滑去看歷史訊息時，不能被輪詢硬拉回底部。
  useEffect(() => {
    // 往前載入更早訊息後，維持原本看到的位置
    if (prevScrollHeight.current != null) {
      const el = scrollRef.current
      if (el) el.scrollTop += el.scrollHeight - prevScrollHeight.current
      prevScrollHeight.current = null
      return
    }
    // 從搜尋結果開啟：捲到最後一則符合的訊息
    if (scrollToHit.current && bubbles.length) {
      scrollToHit.current = false
      const hits = scrollRef.current?.querySelectorAll('[data-hit="1"]')
      const last = hits?.[hits.length - 1] as HTMLElement | undefined
      if (last) {
        nearBottomRef.current = false
        requestAnimationFrame(() => last.scrollIntoView({ block: 'center' }))
        return
      }
    }
    if (nearBottomRef.current) {
      scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
    }
  }, [bubbles])

  const handleThreadScroll = () => {
    const el = scrollRef.current
    if (!el) return
    nearBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 120
  }

  // 開啟中的對話記在網址上：手機下拉重新整理（或 App 被系統重載）後回到同一個對話，不會跳回名單
  const syncUrl = (c: Conversation | null) => {
    try {
      const url = new URL(window.location.href)
      if (c) { url.searchParams.set('platform', c.platform); url.searchParams.set('to', c.from_id) }
      else { url.searchParams.delete('platform'); url.searchParams.delete('to') }
      window.history.replaceState(null, '', url.toString())
    } catch { /* ignore */ }
  }

  const openConvo = (c: Conversation) => {
    syncUrl(c)
    activeKeyRef.current = convoKey(c)
    setActive(c)
    setBubbles([])
    setErr(null)
    setCustomerSummary(null)
    setExtras(null)
    setSummaryOpen(false)
    nearBottomRef.current = true
    scrollToHit.current = !!searchQ
    setHasOlder(false)
    setHasNewer(false)
    loadThread(c, false, searchQ ? c.matchAt : null)
  }

  // 從工單通知（Telegram/LINE/Webhook）點連結進來時，直接開啟指定客人對話，
  // 不用讓專員自己在清單裡大海撈針找是誰——真實案例：專員收到 Telegram 工單通知
  // 完全不知道是哪位客人，也無法直接在 Telegram 回覆客人（Telegram 只是單向通知）。
  const openedFromLink = useRef(false)
  useEffect(() => {
    if (!initialTarget || openedFromLink.current || loadingList) return
    openedFromLink.current = true
    const match = convos.find(c => c.platform === initialTarget.platform && c.from_id === initialTarget.from_id)
    openConvo(match ?? {
      platform: initialTarget.platform, from_id: initialTarget.from_id,
      name: null, stage: '', messageCount: 0, lastMessageAt: '', takeover: false,
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialTarget, loadingList, convos])

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

  // 標記需處理：開一張不會自動結案的工單，名單變紅，處理完按「已處理」
  const flagConvo = async () => {
    if (!active || flagBusy) return
    const note = window.prompt(t('flagNotePrompt'), '')
    if (note === null) return
    const c = active
    setFlagBusy(true)
    try {
      const res = await fetch('/api/marketing/cs-tickets', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          industry, platform: c.platform, from_id: c.from_id, from_name: c.name ?? undefined,
          subject: note.trim() || t('flagDefaultNote'), description: note.trim(), priority: 'high', intent: MANUAL_FLAG_INTENT,
        }),
      })
      if (res.ok) await loadThread(c, true)
    } finally { setFlagBusy(false) }
  }

  const dismissAlert = async () => {
    const ids = extras?.alert?.ticketIds ?? []
    if (!active || !ids.length || flagBusy) return
    const c = active
    setFlagBusy(true)
    try {
      const ok = await Promise.all(ids.map(id => fetch(`/api/marketing/cs-tickets/${id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: 'resolved' }),
      }).then(r => r.ok).catch(() => false)))
      if (ok.every(Boolean)) {
        setExtras(prev => prev ? { ...prev, alert: null } : prev)
        setConvos(prev => prev.map(x => x.platform === c.platform && x.from_id === c.from_id ? { ...x, alert: null } : x))
      }
    } finally { setFlagBusy(false) }
  }

  const toggleTakeover = async () => {
    if (!active) return
    const next = !takeover
    setTakeover(next)
    setActive(prev => prev ? { ...prev, takeover: next } : null)
    setConvos(prev => prev.map(c =>
      c.platform === active.platform && c.from_id === active.from_id
        ? { ...c, takeover: next }
        : c
    ))
    try {
      await fetch('/api/marketing/cs-takeover', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ platform: active.platform, to: active.from_id, industry, takeover: next }),
      })
      loadList()
    } catch {
      setTakeover(!next) // 還原
      setActive(prev => prev ? { ...prev, takeover: !next } : null)
      setConvos(prev => prev.map(c =>
        c.platform === active.platform && c.from_id === active.from_id
          ? { ...c, takeover: !next }
          : c
      ))
    }
  }

  // 真人傳圖片給客人：瀏覽器縮圖 → 上傳 → 推到客人的平台
  const sendImage = async (file: File) => {
    if (!active || sending) return
    setSending(true)
    setErr(null)
    const localUrl = URL.createObjectURL(file)
    const optimistic: Bubble = { side: 'out', sender: 'agent', text: '', image: localUrl, at: new Date().toISOString() }
    setBubbles(prev => [...prev, optimistic])
    nearBottomRef.current = true
    try {
      const imagePath = await uploadInboxImage(file, active.from_id)
      const res = await fetch('/api/marketing/cs-send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ platform: active.platform, to: active.from_id, industry, imagePath }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? t('sendFailed'))
      setTakeover(true)
      loadThread(active, true)
    } catch (e) {
      setErr(e instanceof Error ? e.message : t('sendFailed'))
      setBubbles(prev => prev.filter(b => b !== optimistic))
    } finally {
      setSending(false)
    }
  }

  function pingTyping() {
    if (!active) return
    const now = Date.now()
    if (now - lastTypingPing.current < 15_000) return
    lastTypingPing.current = now
    setTakeover(true)
    void fetch('/api/marketing/cs-takeover', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ platform: active.platform, to: active.from_id, industry, takeover: true, typing: true }),
    }).catch(() => {})
  }

  return (
    <div className="h-[100dvh] min-h-[100dvh] overscroll-none bg-slate-50/50 dark:bg-background">
      <div className="max-w-6xl mx-auto h-full flex flex-col">
        {/* Header：手機版開啟對話時隱藏，下面對話本身的 header 已有返回鍵，
            兩層 header 疊在一起在小螢幕上太佔空間 */}
        <div className={`${active ? 'hidden md:flex' : 'flex'} items-center justify-between gap-3 px-4 sm:px-6 py-4 border-b bg-card/60`}>
          <div className="flex items-center gap-3">
            {/* /cs 現在對已設定用戶會直接導回這頁本身，返回鍵改指向總覽頁才有意義 */}
            <Link href="/cs/dashboard" className="text-muted-foreground hover:text-foreground"><ArrowLeft className="h-5 w-5" /></Link>
            <div className="flex items-center gap-2">
              <Inbox className="h-6 w-6 text-blue-500" />
              <h1 className="text-xl font-bold">{t('title')}</h1>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => setSearchOpen(o => { if (o) setSearchInput(''); return !o })}
              title={t('searchTitle')} aria-label={t('searchTitle')}
              className={`p-1.5 rounded-lg hover:bg-accent ${searchOpen ? 'text-primary' : 'text-muted-foreground hover:text-foreground'}`}>
              <Search className="h-5 w-5" />
            </button>
            <InstallInboxButton label={t('installMobile')} iosHint={t('installIosHintInbox')} />
            <button onClick={() => { loadList(); if (active) loadThread(active) }}
              className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
              <RefreshCw className={`h-4 w-4 ${loadingList ? 'animate-spin' : ''}`} /> {t('refresh')}
            </button>
          </div>
        </div>

        {/* Body: 雙欄 */}
        <div className="flex-1 min-h-0 flex">
          {/* 左：對話清單 */}
          <aside className={`${active ? 'hidden md:flex' : 'flex'} flex-col w-full md:w-72 border-r bg-white shrink-0`}>
            {searchOpen && (
              <div className="p-2 border-b bg-card shrink-0">
                <div className="relative">
                  <Search className="h-4 w-4 text-muted-foreground absolute left-2.5 top-1/2 -translate-y-1/2" />
                  <input autoFocus type="search" value={searchInput} onChange={e => setSearchInput(e.target.value)}
                    placeholder={t('searchPlaceholder')}
                    className="w-full rounded-lg border bg-background pl-8 pr-8 py-2 text-base md:text-sm focus:outline-none focus:ring-2 focus:ring-primary/40" />
                  {searchInput && (
                    <button type="button" onClick={() => setSearchInput('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground">
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>
                {searchQ && <div className="text-[11px] text-muted-foreground mt-1 px-1">{t('searchResultCount', { n: convos.length })}</div>}
              </div>
            )}
            <div className="flex-1 overflow-y-auto overscroll-contain">
              {loadingList && convos.length === 0 ? (
                <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
              ) : convos.length === 0 && searchQ ? (
                <div className="text-center py-16 px-6 text-muted-foreground text-sm">{t('searchNoResult')}</div>
              ) : convos.length === 0 ? (
                <div className="text-center py-16 px-6 text-muted-foreground text-sm">
                  {t('emptyList1')}<br />
                  <span className="text-xs">{t('emptyList2')}</span>
                </div>
              ) : convos.map(c => {
                const isActive = active?.from_id === c.from_id && active?.platform === c.platform
                return (
                  <button key={`${c.platform}:${c.from_id}`} onClick={() => openConvo(c)}
                    className={`w-full text-left px-4 py-3 transition-colors border-l-4 ${c.alert ? 'border-l-rose-500' : 'border-l-transparent'} ${isActive ? 'bg-[#eaf2ff]' : c.alert ? 'bg-rose-50' : 'hover:bg-gray-50'}`}>
                    <div className="flex items-center gap-2">
                      <span className="text-[16px] font-semibold text-gray-900 truncate flex-1">{highlight(formatCustomerName(c.name, c.from_id, t), searchQ)}</span>
                      {c.lastMessageAt && (
                        <span className="text-[12px] text-gray-400 whitespace-nowrap shrink-0">{fmtTime(c.lastMessageAt)}</span>
                      )}
                    </div>
                    {!searchQ && c.preview && (
                      <div className="mt-0.5 text-[14px] text-gray-500 truncate">{c.preview}</div>
                    )}
                    {c.alert && (
                      <span className="inline-block mt-1 mr-1 text-[11px] px-2 py-0.5 rounded-full bg-rose-500 text-white font-medium">
                        {t('needsHumanBadge')}{c.alert.intents[0] && c.alert.intents[0] !== MANUAL_FLAG_INTENT ? `：${c.alert.intents[0]}` : ''}
                      </span>
                    )}
                    {c.takeover && (
                      <span className="inline-block mt-1 text-[11px] px-2 py-0.5 rounded-full border border-amber-300 text-amber-700">
                        {t('humanTakeoverBadge')}
                      </span>
                    )}
                    {searchQ && c.match && (
                      <div className="mt-1 text-[12px] text-gray-500 line-clamp-2 break-all">{highlight(c.match, searchQ)}</div>
                    )}
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
                    <button onClick={() => { syncUrl(null); activeKeyRef.current = null; setActive(null) }} className="md:hidden text-muted-foreground"><ChevronLeft className="h-5 w-5" /></button>
                    <span className="text-base">{plat(active.platform).emoji}</span>
                    <div className="min-w-0">
                      <div className="font-semibold truncate">{formatCustomerName(active.name, active.from_id, t)}</div>
                      <div className="text-[11px] text-muted-foreground">{plat(active.platform).name} · {active.from_id}</div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={toggleTakeover}
                    title={takeover ? t('takeoverTooltipOn') : t('takeoverTooltipOff')}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium border shadow-xs transition-all cursor-pointer ${
                      takeover
                        ? 'bg-amber-50 text-amber-800 border-amber-300 hover:bg-amber-100 dark:bg-amber-950/60 dark:text-amber-200 dark:border-amber-800'
                        : 'bg-emerald-50 text-emerald-800 border-emerald-300 hover:bg-emerald-100 dark:bg-emerald-950/60 dark:text-emerald-200 dark:border-emerald-800'
                    }`}
                  >
                    <span className="flex h-2 w-2 relative">
                      <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                        takeover ? 'bg-amber-400' : 'bg-emerald-400'
                      }`} />
                      <span className={`relative inline-flex rounded-full h-2 w-2 ${
                        takeover ? 'bg-amber-500' : 'bg-emerald-500'
                      }`} />
                    </span>
                    {takeover ? (
                      <span className="flex items-center gap-1.5">
                        <UserRound className="h-3.5 w-3.5 text-amber-600" />
                        <span className="font-semibold">{t('humanTakeoverActive')}</span>
                        <span className="ml-1 px-2 py-0.5 rounded-md bg-amber-200/80 dark:bg-amber-900/80 text-[11px] font-bold text-amber-900 dark:text-amber-100 hover:underline">
                          {t('resumeAiButton')}
                        </span>
                      </span>
                    ) : (
                      <span className="flex items-center gap-1.5">
                        <Bot className="h-3.5 w-3.5 text-emerald-600" />
                        <span className="font-semibold">{t('aiAutoReplying')}</span>
                        <span className="ml-1 px-2 py-0.5 rounded-md bg-emerald-200/80 dark:bg-emerald-900/80 text-[11px] font-bold text-emerald-900 dark:text-emerald-100 hover:underline">
                          {t('pauseAiButton')}
                        </span>
                      </span>
                    )}
                  </button>
                </div>

                {/* 操作列：標記需處理、客戶檔案（CRM） */}
                <div className="flex items-center gap-2 px-4 py-1.5 border-b bg-card/40 text-[12px]">
                  <button type="button" onClick={() => void flagConvo()} disabled={flagBusy}
                    className="px-2.5 py-1 rounded-full border border-rose-300 text-rose-700 bg-white disabled:opacity-50">
                    {t('flagNeedsAction')}
                  </button>
                  <a href={extras?.crmContactId ? `/crm?contact=${encodeURIComponent(extras.crmContactId)}` : `/crm?q=${encodeURIComponent(active.name || active.from_id)}`}
                    target="_blank" rel="noopener noreferrer"
                    className="px-2.5 py-1 rounded-full border border-indigo-300 text-indigo-700 bg-white">
                    {t('crmLink')}
                  </a>
                </div>

                {/* 需要真人提醒 */}
                {extras?.alert && (
                  <div className="flex items-center gap-2 px-4 py-2 border-b bg-rose-50 text-[13px] text-rose-800">
                    <span className="font-semibold shrink-0">{t('needsHumanBadge')}</span>
                    <span className="flex-1 min-w-0 truncate">
                      {extras.alert.intents.filter(i => i !== MANUAL_FLAG_INTENT).concat(extras.alert.notes ?? []).join('、') || extras.alert.intents.join('、')}
                    </span>
                    <button type="button" onClick={() => void dismissAlert()} disabled={flagBusy}
                      className="shrink-0 px-2.5 py-1 rounded-full border border-rose-300 bg-white text-rose-700 text-[12px] disabled:opacity-50">
                      {t('alertDismiss')}
                    </button>
                  </div>
                )}

                {/* 訂房／預約資訊與客人摘要（AI 依對話累積自動生成，非即時） */}
                {(extras?.booking || extras?.reservation || customerSummary) && (
                  <div className="px-4 py-2 border-b bg-[#f7f9fc] text-[13px] text-gray-700 space-y-1">
                    {extras?.booking && (() => {
                      const b = extras.booking
                      const md = (d: string) => `${Number(d.slice(5, 7))}/${Number(d.slice(8, 10))}`
                      return (
                        <a href={`/booking/bookings/${b.id}`} target="_blank" rel="noopener noreferrer" className="block text-[#1a73e8]">
                          🗓 {md(b.checkIn)}–{md(b.checkOut)}{b.room ? ` · ${b.room}` : ''}{b.guestName ? ` · ${b.guestName}` : ''}{b.guests ? ` · ${b.guests}` : ''}
                        </a>
                      )
                    })()}
                    {extras?.reservation && (() => {
                      const r = extras.reservation
                      const when = new Date(r.startTime).toLocaleString(locale, { timeZone: 'Asia/Taipei', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
                      return (
                        <a href={`/reserve/appointments?id=${encodeURIComponent(r.id)}`} target="_blank" rel="noopener noreferrer" className="block text-[#1a73e8]">
                          📅 {when}{r.service ? ` · ${r.service}` : ''}{r.staff ? ` · ${r.staff}` : ''}{r.store ? ` · ${r.store}` : ''} · {r.statusLabel}
                        </a>
                      )
                    })()}
                    {customerSummary && (
                      <button type="button" onClick={() => setSummaryOpen(o => !o)} className="flex items-start gap-2 w-full text-left">
                        <span className={`flex-1 min-w-0 ${summaryOpen ? 'whitespace-pre-wrap' : 'line-clamp-1'}`}>
                          <span className="font-semibold text-gray-800">{t('customerSummaryTitle')}：</span>{customerSummary}
                        </span>
                        <span className="shrink-0 text-[11px] text-[#1a73e8] mt-0.5">{summaryOpen ? t('summaryCollapse') : t('summaryExpand')}</span>
                      </button>
                    )}
                  </div>
                )}

                {/* 訊息串 */}
                <div ref={scrollRef} onScroll={handleThreadScroll} className="flex-1 overflow-y-auto overscroll-contain px-4 py-4 space-y-3">
                  {loadingThread ? (
                    <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
                  ) : bubbles.length === 0 ? (
                    <div className="text-center py-16 text-muted-foreground text-sm">{t('noMessages')}</div>
                  ) : <>
                  {hasOlder && (
                    <div className="flex justify-center">
                      <button type="button" onClick={loadOlder} disabled={loadingOlder}
                        className="text-xs px-3 py-1 rounded-full border bg-card text-muted-foreground hover:text-foreground disabled:opacity-50">
                        {loadingOlder ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : t('loadOlder')}
                      </button>
                    </div>
                  )}
                  {bubbles.map((b, i) => (
                    <div key={i} data-hit={searchQ && b.text.toLowerCase().includes(searchQ.toLowerCase()) ? '1' : undefined}
                      className={`flex ${b.side === 'out' ? 'justify-end' : 'justify-start'}`}>
                      <div className="max-w-[78%]">
                        {b.side === 'out' && (
                          <div className={`text-[10px] mb-0.5 text-right ${b.sender === 'agent' ? 'text-amber-600' : 'text-blue-500'}`}>
                            {b.sender === 'agent' ? t('agentLabel') : 'AI'}
                          </div>
                        )}
                        <div className={`rounded-2xl px-3.5 py-2 text-sm whitespace-pre-wrap break-words ${
                          b.side === 'in'
                            ? 'bg-[#f1f2f4] text-gray-800 rounded-tl-sm'
                            : b.sender === 'agent'
                              ? 'bg-[#fdf0d5] text-gray-800 rounded-tr-sm'
                              : 'bg-[#d6e9ff] text-gray-800 rounded-tr-sm'
                        }`}>
                          {b.image ? (
                            <a href={b.image} target="_blank" rel="noreferrer">
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img src={b.image} alt="" className="max-w-full max-h-72 rounded-lg" />
                            </a>
                          ) : (() => {
                            const parts = splitBubbleImages(b.text)
                            return (
                              <>
                                {parts.text && highlight(parts.text, searchQ)}
                                {parts.images.map(url => (
                                  <a key={url} href={url} target="_blank" rel="noreferrer" className="block mt-1.5">
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img src={url} alt="" loading="lazy" className="max-w-full max-h-72 rounded-lg" />
                                  </a>
                                ))}
                              </>
                            )
                          })()}
                        </div>
                        <div className={`text-[10px] text-muted-foreground mt-0.5 flex items-center gap-2 ${b.side === 'out' ? 'justify-end' : ''}`}>
                          {b.side === 'out' && !!b.text.trim() && (
                            <button type="button" title={t('addToFaq')}
                              onClick={() => {
                                const prevIn = [...bubbles.slice(0, i)].reverse().find(x => x.side === 'in')
                                setFaq({ q: prevIn?.text ?? '', a: b.text, saving: false, done: false })
                              }}
                              className="text-[#1a73e8]">＋{t('faqShort')}</button>
                          )}
                          <span>{fmtClock(b.at)}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                  {hasNewer && (
                    <div className="flex justify-center">
                      <button type="button" onClick={() => { nearBottomRef.current = true; loadThread(active) }}
                        className="text-xs px-3 py-1 rounded-full border bg-card text-muted-foreground hover:text-foreground">
                        {t('jumpToLatest')}
                      </button>
                    </div>
                  )}
                  </>}
                </div>

                {/* 加到常見問答：底部精簡面板 */}
                {faq && (
                  <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/30" onClick={() => !faq.saving && setFaq(null)}>
                    <div className="w-full md:max-w-md bg-white rounded-t-2xl md:rounded-2xl p-4 space-y-2" onClick={e => e.stopPropagation()}>
                      <div className="text-sm font-semibold">{t('addToFaq')}</div>
                      <textarea value={faq.q} onChange={e => setFaq({ ...faq, q: e.target.value })} rows={2}
                        placeholder={t('faqQuestionPh')} className="w-full text-base md:text-sm border rounded-lg px-3 py-2" />
                      <textarea value={faq.a} onChange={e => setFaq({ ...faq, a: e.target.value })} rows={4}
                        className="w-full text-base md:text-sm border rounded-lg px-3 py-2" />
                      <div className="flex gap-2 justify-end">
                        <button type="button" onClick={() => setFaq(null)} disabled={faq.saving}
                          className="px-3 py-1.5 text-sm rounded-lg border">{t('faqCancel')}</button>
                        <button type="button" onClick={() => void saveFaq()} disabled={faq.saving || faq.done || !faq.a.trim()}
                          className="px-3 py-1.5 text-sm rounded-lg bg-[#1a73e8] text-white disabled:opacity-60 inline-flex items-center gap-1">
                          {faq.saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                          {faq.done ? t('faqSaved') : t('faqSave')}
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* 回覆框 */}
                <div className="border-t bg-card/60 px-3 py-3">
                  {err && <div className="text-xs text-rose-600 mb-2 px-1">{err}</div>}
                  {takeover ? (
                    <div className="flex items-center text-[11px] bg-amber-50 dark:bg-amber-950/50 border border-amber-200/80 dark:border-amber-900 rounded-lg px-3 py-1.5 mb-2 text-amber-900 dark:text-amber-200">
                      <span className="flex items-center gap-1.5">
                        <UserRound className="h-3.5 w-3.5 text-amber-600 shrink-0" />
                        <span>{t.rich('takeoverActiveHint', { b: (chunks) => <strong>{chunks}</strong> })}</span>
                      </span>
                    </div>
                  ) : (
                    <div className="flex items-center text-[11px] bg-slate-50 dark:bg-slate-900/50 border border-slate-200/80 dark:border-slate-800 rounded-lg px-3 py-1.5 mb-2 text-muted-foreground">
                      <span className="flex items-center gap-1.5">
                        <Bot className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                        <span>{t.rich('aiReplyingHint', { b: (chunks) => <strong>{chunks}</strong> })}</span>
                      </span>
                    </div>
                  )}
                  <div className="flex items-end gap-2">
                    <input ref={imageInputRef} type="file" accept="image/*" className="hidden"
                      onChange={e => { const f = e.target.files?.[0]; e.target.value = ''; if (f) void sendImage(f) }} />
                    <button type="button" onClick={() => imageInputRef.current?.click()} disabled={sending}
                      title={t('sendImage')} aria-label={t('sendImage')}
                      className="flex items-center justify-center h-10 w-10 rounded-xl border text-muted-foreground hover:text-foreground hover:bg-accent disabled:opacity-40 shrink-0">
                      <ImagePlus className="h-5 w-5" />
                    </button>
                    <textarea
                      value={draft}
                      onChange={e => { setDraft(e.target.value); if (e.target.value.trim()) pingTyping() }}
                      onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey && !window.matchMedia('(pointer: coarse)').matches) { e.preventDefault(); send() } }}
                      placeholder={t('replyPlaceholder', { name: formatCustomerName(active.name, active.from_id, t) })}
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
