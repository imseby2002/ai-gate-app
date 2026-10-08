'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useTranslations, useLocale } from 'next-intl'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Mic, MicOff, Copy, LogOut, Plus, Users, Video, VideoOff } from 'lucide-react'

// ── 型別 ──────────────────────────────────────────────────────────
interface Me { id: string; name: string }
interface Meeting { id: string; title: string; room_code: string; host_id: string; source_lang: string }
interface Line {
  id: string
  speaker_id: string
  speaker_name: string
  content: string
  source_lang: string
  created_at: string
}

// 可辨識／翻譯的語言（對應 /api/work/translate 支援的目標語言）
const LANGS: { code: string; label: string; sr: string }[] = [
  { code: 'zh-TW', label: '中文', sr: 'zh-TW' },
  { code: 'en', label: 'English', sr: 'en-US' },
  { code: 'vi', label: 'Tiếng Việt', sr: 'vi-VN' },
]
const TRANSLATABLE = new Set(LANGS.map(l => l.code))

// ── Web Speech API（瀏覽器內建，無需套件）最小型別 ────────────────
interface SRAlternative { transcript: string }
interface SRResult { isFinal: boolean; 0: SRAlternative }
interface SRResultList { length: number; [i: number]: SRResult }
interface SREvent { resultIndex: number; results: SRResultList }
interface SpeechRec {
  lang: string
  continuous: boolean
  interimResults: boolean
  start(): void
  stop(): void
  onresult: ((e: SREvent) => void) | null
  onerror: ((e: { error: string }) => void) | null
  onend: (() => void) | null
}
type SRCtor = new () => SpeechRec

function getSRCtor(): SRCtor | null {
  if (typeof window === 'undefined') return null
  const w = window as unknown as { SpeechRecognition?: SRCtor; webkitSpeechRecognition?: SRCtor }
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null
}

// ── JaaS 視訊（8x8 Jitsi as a Service，CDN 嵌入，無需套件）───────────
// 以 NEXT_PUBLIC_JAAS_APP_ID 是否存在來判斷是否啟用視訊。
const JAAS_APP_ID = process.env.NEXT_PUBLIC_JAAS_APP_ID
interface JaasApi { dispose(): void }
type JaasCtor = new (domain: string, options: Record<string, unknown>) => JaasApi

function loadJaasScript(appId: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const w = window as unknown as { JitsiMeetExternalAPI?: JaasCtor }
    if (w.JitsiMeetExternalAPI) return resolve()
    const existing = document.querySelector<HTMLScriptElement>('script[data-jaas="1"]')
    if (existing) {
      existing.addEventListener('load', () => resolve())
      existing.addEventListener('error', () => reject(new Error('jaas script load failed')))
      return
    }
    const s = document.createElement('script')
    s.src = `https://8x8.vc/${appId}/external_api.js`
    s.async = true
    s.dataset.jaas = '1'
    s.onload = () => resolve()
    s.onerror = () => reject(new Error('jaas script load failed'))
    document.body.appendChild(s)
  })
}

// ── 翻譯快取（跨元件共用）──────────────────────────────────────────
const transCache = new Map<string, string>()
const tkey = (locale: string, text: string) => `${locale}:${text}`

function fmtTime(iso: string) {
  const d = new Date(iso)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

export default function MeetingPage() {
  const t = useTranslations('Meeting')
  const locale = useLocale()
  // createClient() 回傳單例，直接取用即可（不需 useRef，避免 render 期存取 ref）
  const supabase = createClient()

  const [me, setMe] = useState<Me | null>(null)
  const [meeting, setMeeting] = useState<Meeting | null>(null)
  const [lines, setLines] = useState<Line[]>([])
  const [participants, setParticipants] = useState<string[]>([])

  const [newTitle, setNewTitle] = useState('')
  const [joinCode, setJoinCode] = useState('')
  const [myLang, setMyLang] = useState<string>(TRANSLATABLE.has(locale) ? locale : 'zh-TW')
  const [err, setErr] = useState('')
  const [copied, setCopied] = useState(false)

  const [recording, setRecording] = useState(false)
  const [micDenied, setMicDenied] = useState(false)
  const srSupported = typeof window !== 'undefined' && !!getSRCtor()

  const recRef = useRef<SpeechRec | null>(null)
  const recordingRef = useRef(false)
  const restartTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const wakeLockRef = useRef<{ release: () => Promise<void> | void } | null>(null)
  const audioKeepAliveRef = useRef<AudioContext | null>(null)
  const lastActiveRef = useRef<number>(Date.now())
  const bottomRef = useRef<HTMLDivElement | null>(null)

  // 視訊（JaaS）
  const [video, setVideo] = useState<{ jwt: string; room: string } | null>(null)
  const [videoLoading, setVideoLoading] = useState(false)
  const videoBoxRef = useRef<HTMLDivElement | null>(null)
  const jaasApiRef = useRef<JaasApi | null>(null)

  // ── 載入使用者 ──
  useEffect(() => {
    let alive = true
    ;(async () => {
      const { data: auth } = await supabase.auth.getUser()
      const user = auth.user
      if (!user || !alive) return
      const { data: profile } = await supabase.from('profiles').select('full_name').eq('id', user.id).single()
      setMe({ id: user.id, name: profile?.full_name || user.email || 'me' })
    })()
    return () => { alive = false }
  }, [supabase])

  // ── 進入會議後：載入既有逐字稿 + 參與者 ──
  const loadMeetingData = useCallback(async (m: Meeting) => {
    const [{ data: ls }, { data: ps }] = await Promise.all([
      supabase.from('meeting_lines').select('*').eq('meeting_id', m.id).order('created_at', { ascending: true }),
      supabase.from('meeting_participants').select('name').eq('meeting_id', m.id),
    ])
    setLines((ls ?? []) as Line[])
    setParticipants(((ps ?? []) as { name: string }[]).map(p => p.name).filter(Boolean))
  }, [supabase])

  // ── Realtime：逐字稿即時同步 + 斷線自動重連 ──
  useEffect(() => {
    if (!meeting) return
    let active = true

    const setupChannel = () => {
      const ch = supabase
        .channel(`meeting_${meeting.id}`)
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'meeting_lines', filter: `meeting_id=eq.${meeting.id}` },
          payload => {
            const l = payload.new as Line
            setLines(prev => (prev.some(x => x.id === l.id) ? prev : [...prev, l]))
          },
        )
        .subscribe(status => {
          if (!active) return
          if (status === 'TIMED_OUT' || status === 'CHANNEL_ERROR' || status === 'CLOSED') {
            console.warn('[Meeting] Realtime status:', status, 'will retry connection...')
            setTimeout(() => {
              if (active) setupChannel()
            }, 3000)
          }
        })
      return ch
    }

    const ch = setupChannel()
    return () => {
      active = false
      supabase.removeChannel(ch)
    }
  }, [meeting, supabase])

  // ── 備援定時同步：防止 WebSocket 長期連線中斷或 JWT 逾時導致漏訊 ──
  useEffect(() => {
    if (!meeting) return
    let alive = true

    const syncLatest = async () => {
      try {
        const { data: latest } = await supabase
          .from('meeting_lines')
          .select('*')
          .eq('meeting_id', meeting.id)
          .order('created_at', { ascending: true })

        if (!alive || !latest) return
        setLines(prev => {
          const map = new Map<string, Line>()
          prev.forEach(item => map.set(item.id, item))
          ;(latest as Line[]).forEach(item => map.set(item.id, item))
          return Array.from(map.values()).sort((a, b) => a.created_at.localeCompare(b.created_at))
        })
      } catch (e) {
        console.warn('[Meeting] Polling sync error:', e)
      }
    }

    const interval = setInterval(syncLatest, 6000)
    return () => {
      alive = false
      clearInterval(interval)
    }
  }, [meeting, supabase])

  // ── 自動捲到底 ──
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [lines.length])

  // ── 檢視者：把非本語言的逐字翻成自己的介面語言 ──
  const [, forceTick] = useState(0)
  useEffect(() => {
    if (!TRANSLATABLE.has(locale)) return
    const need = Array.from(
      new Set(lines.filter(l => l.source_lang !== locale).map(l => l.content.trim()).filter(Boolean)),
    ).filter(txt => !transCache.has(tkey(locale, txt)))
    if (!need.length) return
    let alive = true
    fetch('/api/work/translate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ texts: need, target: locale }),
    })
      .then(r => r.json())
      .then(d => {
        if (!alive || !Array.isArray(d.translations)) return
        need.forEach((txt, i) => transCache.set(tkey(locale, txt), d.translations[i] ?? txt))
        forceTick(x => x + 1)
      })
      .catch(() => {})
    return () => { alive = false }
  }, [lines, locale])

  function translatedOf(l: Line): string | null {
    if (l.source_lang === locale || !TRANSLATABLE.has(locale)) return null
    const tr = transCache.get(tkey(locale, l.content.trim()))
    return tr && tr !== l.content.trim() ? tr : null
  }

  // ── 建立 / 加入 ──
  async function createMeeting() {
    setErr('')
    const { data, error } = await supabase
      .from('meetings')
      .insert({ title: newTitle.trim(), source_lang: myLang })
      .select('id, title, room_code, host_id, source_lang')
      .single()
    if (error || !data) { setErr(t('createFailed')); return }
    await supabase.from('meeting_participants').insert({ meeting_id: data.id, name: me?.name ?? '' })
    const m = data as Meeting
    setMeeting(m)
    loadMeetingData(m)
  }

  async function joinMeeting() {
    setErr('')
    const code = joinCode.trim()
    if (!code) return
    const { data, error } = await supabase.rpc('join_meeting', { p_code: code })
    const row = (Array.isArray(data) ? data[0] : data) as
      | { id: string; title: string; host_id: string; source_lang: string }
      | undefined
    if (error || !row) { setErr(t('notFound')); return }
    const m: Meeting = { id: row.id, title: row.title, room_code: code.toUpperCase(), host_id: row.host_id, source_lang: row.source_lang }
    setMeeting(m)
    loadMeetingData(m)
  }

  // ── 麥克風辨識寫入資料庫 ──
  const addLine = useCallback(async (text: string) => {
    const clean = text.trim()
    if (!clean || !meeting) return

    try {
      let { data, error } = await supabase
        .from('meeting_lines')
        .insert({
          meeting_id: meeting.id,
          speaker_name: me?.name ?? '',
          content: clean,
          source_lang: myLang,
        })
        .select('*')
        .single()

      if (error) {
        console.warn('[Meeting] addLine error, refreshing token...', error)
        await supabase.auth.refreshSession()
        const retry = await supabase
          .from('meeting_lines')
          .insert({
            meeting_id: meeting.id,
            speaker_name: me?.name ?? '',
            content: clean,
            source_lang: myLang,
          })
          .select('*')
          .single()
        data = retry.data
        error = retry.error
      }

      if (data) {
        const newLine = data as Line
        setLines(prev => (prev.some(x => x.id === newLine.id) ? prev : [...prev, newLine]))
      }
    } catch (e) {
      console.error('[Meeting] addLine exception:', e)
    }
  }, [supabase, meeting, me, myLang])

  const cleanupRec = useCallback(() => {
    if (restartTimerRef.current) {
      clearTimeout(restartTimerRef.current)
      restartTimerRef.current = null
    }
    if (recRef.current) {
      try {
        recRef.current.onresult = null
        recRef.current.onerror = null
        recRef.current.onend = null
        recRef.current.stop()
      } catch {}
      recRef.current = null
    }
  }, [])

  const startRecognizerInstance = useCallback(() => {
    if (!recordingRef.current) return
    cleanupRec()

    const Ctor = getSRCtor()
    if (!Ctor) return

    try {
      const rec = new Ctor()
      rec.lang = LANGS.find(l => l.code === myLang)?.sr ?? 'zh-TW'
      rec.continuous = true
      rec.interimResults = true

      rec.onresult = (e: SREvent) => {
        lastActiveRef.current = Date.now()
        for (let i = e.resultIndex; i < e.results.length; i++) {
          const r = e.results[i]
          if (r.isFinal) void addLine(r[0].transcript)
        }
      }

      rec.onerror = (ev: { error: string }) => {
        console.warn('[Meeting] Speech recognition error:', ev.error)
        if (ev.error === 'not-allowed' || ev.error === 'service-not-allowed') {
          setMicDenied(true)
          recordingRef.current = false
          setRecording(false)
          cleanupRec()
          return
        }
        // 暫時性錯誤交由 onend 稍後以全新實例重啟
      }

      rec.onend = () => {
        // Chromium 連線中斷或 Google 伺服器 Session 到期時會觸發 onend
        if (recordingRef.current) {
          if (restartTimerRef.current) clearTimeout(restartTimerRef.current)
          // 短暫延遲 250ms，讓瀏覽器音訊圖釋放後以全新實例無縫重啟
          restartTimerRef.current = setTimeout(() => {
            if (recordingRef.current) {
              startRecognizerInstance()
            }
          }, 250)
        }
      }

      recRef.current = rec
      lastActiveRef.current = Date.now()
      rec.start()
    } catch (err) {
      console.warn('[Meeting] Recognizer start failed, retrying in 1s:', err)
      if (recordingRef.current) {
        if (restartTimerRef.current) clearTimeout(restartTimerRef.current)
        restartTimerRef.current = setTimeout(() => {
          if (recordingRef.current) {
            startRecognizerInstance()
          }
        }, 1000)
      }
    }
  }, [cleanupRec, myLang, addLine])

  const startRec = useCallback(async () => {
    const Ctor = getSRCtor()
    if (!Ctor) return
    setMicDenied(false)
    recordingRef.current = true
    setRecording(true)
    lastActiveRef.current = Date.now()

    // 請求 Screen Wake Lock 避免會議期間因螢幕休眠被作業系統凍結
    if (typeof navigator !== 'undefined' && 'wakeLock' in navigator) {
      try {
        const lock = await (navigator as unknown as { wakeLock: { request: (t: string) => Promise<{ release: () => Promise<void> }> } }).wakeLock.request('screen')
        wakeLockRef.current = lock
      } catch {}
    }

    // 啟動近乎靜音的 AudioContext，防止 Chrome 將背景分頁判定為閒置並凍結語音輸入
    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
      if (AudioCtx && !audioKeepAliveRef.current) {
        const ctx = new AudioCtx()
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()
        gain.gain.setValueAtTime(0.00001, ctx.currentTime)
        osc.connect(gain)
        gain.connect(ctx.destination)
        osc.start()
        audioKeepAliveRef.current = ctx
      }
    } catch {}

    startRecognizerInstance()
  }, [startRecognizerInstance])

  const stopRec = useCallback(() => {
    recordingRef.current = false
    setRecording(false)
    cleanupRec()
    if (wakeLockRef.current) {
      try { void wakeLockRef.current.release() } catch {}
      wakeLockRef.current = null
    }
    if (audioKeepAliveRef.current) {
      try { void audioKeepAliveRef.current.close() } catch {}
      audioKeepAliveRef.current = null
    }
  }, [cleanupRec])

  // ── 語音辨識看門狗（防範瀏覽器長時間背景或無聲導致連線靜止）──
  useEffect(() => {
    if (!recording) return

    const interval = setInterval(() => {
      if (!recordingRef.current) return
      // 若超過 45 秒沒有任何識別活動（防範 Chrome Google 語音後端連線卡死且未觸發 onend）
      const idle = Date.now() - lastActiveRef.current
      if (idle > 45000) {
        console.log('[Meeting] Watchdog: recognition idle > 45s, refreshing instance...')
        startRecognizerInstance()
      }
    }, 10000)

    const handleVisibility = () => {
      if (document.visibilityState === 'visible' && recordingRef.current) {
        if (Date.now() - lastActiveRef.current > 15000) {
          startRecognizerInstance()
        }
      }
    }
    document.addEventListener('visibilitychange', handleVisibility)

    return () => {
      clearInterval(interval)
      document.removeEventListener('visibilitychange', handleVisibility)
    }
  }, [recording, startRecognizerInstance])

  // 元件卸載時清理
  useEffect(() => {
    return () => {
      stopRec()
    }
  }, [stopRec])

  // ── 視訊（JaaS）：開啟時取 token、載入 CDN 腳本、掛載 iframe ──
  async function startVideo() {
    if (!meeting || !JAAS_APP_ID || videoLoading) return
    setVideoLoading(true)
    setErr('')
    try {
      const res = await fetch('/api/meeting/jaas-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ meetingId: meeting.id }),
      })
      if (!res.ok) { setErr(t('videoFailed')); return }
      const { jwt, room } = (await res.json()) as { jwt: string; room: string }
      await loadJaasScript(JAAS_APP_ID)
      setVideo({ jwt, room })
    } catch {
      setErr(t('videoFailed'))
    } finally {
      setVideoLoading(false)
    }
  }

  function stopVideo() {
    setVideo(null)
  }

  // video 設定後掛載 JaaS iframe；清除時 dispose
  useEffect(() => {
    if (!video || !videoBoxRef.current || !JAAS_APP_ID) return
    const w = window as unknown as { JitsiMeetExternalAPI?: JaasCtor }
    if (!w.JitsiMeetExternalAPI) return
    const api = new w.JitsiMeetExternalAPI('8x8.vc', {
      roomName: `${JAAS_APP_ID}/${video.room}`,
      jwt: video.jwt,
      parentNode: videoBoxRef.current,
      configOverwrite: { prejoinPageEnabled: false, startWithAudioMuted: true, startWithVideoMuted: false },
    })
    jaasApiRef.current = api
    return () => {
      try { api.dispose() } catch {}
      jaasApiRef.current = null
    }
  }, [video])

  function leaveMeeting() {
    stopRec()
    stopVideo()
    setMeeting(null)
    setLines([])
    setParticipants([])
    setJoinCode('')
    setNewTitle('')
  }

  async function copyCode() {
    if (!meeting) return
    try {
      await navigator.clipboard.writeText(meeting.room_code)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {}
  }

  // ── 大廳 ──
  if (!meeting) {
    return (
      <div className="mx-auto max-w-2xl space-y-5 p-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0"><Video className="h-5 w-5 text-primary" /></div>
          <div>
            <h1 className="text-2xl font-bold">{t('title')}</h1>
            <p className="text-sm text-muted-foreground">{t('subtitle')}</p>
          </div>
        </div>

        {!srSupported && (
          <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-700 dark:bg-amber-950/40 dark:text-amber-400">
            {t('unsupported')}
          </p>
        )}

        <LangPicker value={myLang} onChange={setMyLang} label={t('myLang')} />

        <Card className="space-y-3 p-4">
          <p className="text-sm font-medium">{t('createHeading')}</p>
          <Input value={newTitle} onChange={e => setNewTitle(e.target.value)} placeholder={t('titlePh')} />
          <Button onClick={createMeeting} className="gap-1.5"><Plus className="h-4 w-4" />{t('create')}</Button>
        </Card>

        <Card className="space-y-3 p-4">
          <p className="text-sm font-medium">{t('joinHeading')}</p>
          <div className="flex gap-2">
            <Input
              value={joinCode}
              onChange={e => setJoinCode(e.target.value.toUpperCase())}
              onKeyDown={e => { if (e.key === 'Enter') joinMeeting() }}
              placeholder={t('roomCodePh')}
              className="font-mono tracking-widest uppercase"
            />
            <Button variant="outline" onClick={joinMeeting} disabled={!joinCode.trim()}>{t('join')}</Button>
          </div>
        </Card>

        {err && <p className="text-sm text-red-500">{err}</p>}
      </div>
    )
  }

  // ── 會議中 ──
  return (
    <div className="mx-auto flex h-full max-w-2xl flex-col gap-3 p-6">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="truncate text-xl font-bold">{meeting.title || t('title')}</h1>
          <button onClick={copyCode} className="mt-0.5 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
            <span>{t('roomCode')}：</span>
            <span className="font-mono text-base font-bold tracking-widest text-foreground">{meeting.room_code}</span>
            <Copy className="h-3.5 w-3.5" />
            {copied && <span className="text-xs text-emerald-600">{t('copied')}</span>}
          </button>
          {participants.length > 0 && (
            <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
              <Users className="h-3 w-3" />{t('participants')}（{participants.length}）：{participants.join('、')}
            </p>
          )}
        </div>
        <Button variant="ghost" size="sm" onClick={leaveMeeting} className="shrink-0 gap-1.5">
          <LogOut className="h-4 w-4" />{t('leave')}
        </Button>
      </div>

      <div className="flex items-center gap-2 border-y py-2">
        <LangPicker value={myLang} onChange={setMyLang} label={t('myLang')} disabled={recording} compact />
        {srSupported ? (
          recording ? (
            <Button size="sm" variant="destructive" onClick={stopRec} className="gap-1.5">
              <MicOff className="h-4 w-4" />{t('stop')}
            </Button>
          ) : (
            <Button size="sm" onClick={startRec} className="gap-1.5">
              <Mic className="h-4 w-4" />{t('start')}
            </Button>
          )
        ) : (
          <span className="text-xs text-muted-foreground">{t('unsupported')}</span>
        )}
        {recording && (
          <span className="flex items-center gap-1.5 text-xs text-red-500">
            <span className="h-2 w-2 animate-pulse rounded-full bg-red-500" />{t('listening')}
          </span>
        )}
        {JAAS_APP_ID && (
          <div className="ml-auto">
            {video ? (
              <Button size="sm" variant="outline" onClick={stopVideo} className="gap-1.5">
                <VideoOff className="h-4 w-4" />{t('videoStop')}
              </Button>
            ) : (
              <Button size="sm" variant="outline" onClick={startVideo} disabled={videoLoading} className="gap-1.5">
                <Video className="h-4 w-4" />{videoLoading ? t('videoLoading') : t('videoStart')}
              </Button>
            )}
          </div>
        )}
      </div>

      {micDenied && <p className="text-sm text-red-500">{t('micDenied')}</p>}

      {video && <div ref={videoBoxRef} className="h-72 w-full overflow-hidden rounded-lg border bg-black" />}

      <div className="flex-1 space-y-2 overflow-y-auto rounded-lg border p-3">
        {lines.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">{t('empty')}</p>
        ) : (
          lines.map(l => {
            const tr = translatedOf(l)
            const mine = l.speaker_id === me?.id
            return (
              <div key={l.id} className="text-sm">
                <div className="flex items-baseline gap-2">
                  <span className={`font-medium ${mine ? 'text-blue-600 dark:text-blue-400' : ''}`}>
                    {mine ? t('you') : (l.speaker_name || '—')}
                  </span>
                  <span className="text-[11px] text-muted-foreground">{fmtTime(l.created_at)}</span>
                </div>
                <p className="whitespace-pre-wrap break-words">{l.content}</p>
                {tr && <p className="mt-0.5 whitespace-pre-wrap break-words text-[13px] text-muted-foreground">↳ {tr}</p>}
              </div>
            )
          })
        )}
        <div ref={bottomRef} />
      </div>
    </div>
  )
}

// ── 語言選擇器 ────────────────────────────────────────────────────
function LangPicker({
  value, onChange, label, disabled, compact,
}: {
  value: string
  onChange: (v: string) => void
  label: string
  disabled?: boolean
  compact?: boolean
}) {
  return (
    <label className={`flex items-center gap-2 ${compact ? 'text-xs' : 'text-sm'}`}>
      <span className="text-muted-foreground">{label}</span>
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        disabled={disabled}
        className="rounded-md border bg-background px-2 py-1 text-sm disabled:opacity-50"
      >
        {LANGS.map(l => <option key={l.code} value={l.code}>{l.label}</option>)}
      </select>
    </label>
  )
}
