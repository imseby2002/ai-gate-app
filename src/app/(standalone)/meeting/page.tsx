'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useTranslations, useLocale } from 'next-intl'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import {
  Mic, MicOff, Copy, LogOut, Plus, Users, Video, VideoOff,
  Building2, Store, CheckCircle2, AlertCircle, Languages,
  Sparkles, Radio, Eye
} from 'lucide-react'

// ── 型別 ──────────────────────────────────────────────────────────
interface Me { id: string; name: string }
interface Meeting {
  id: string
  title: string
  room_code: string
  host_id: string
  source_lang: string
  department?: string
  meeting_mode?: 'online' | 'in_person'
  stores?: string[]
  context_keywords?: string
}

interface DeptOption {
  key: string
  label: string
  icon: string
}

interface StoreOption {
  id: string
  code: string
  name: string
  short_name: string
}

interface VoiceProfile {
  status: string
  language: string
  audio_url: string
  updated_at?: string
}

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

  const [departments, setDepartments] = useState<DeptOption[]>([])
  const [storeList, setStoreList] = useState<StoreOption[]>([])
  const [voiceProfile, setVoiceProfile] = useState<VoiceProfile | null>(null)
  const [fixedSentences, setFixedSentences] = useState<Record<string, string>>({})

  const [newTitle, setNewTitle] = useState('')
  const [selectedDept, setSelectedDept] = useState('store')
  const [selectedMode, setSelectedMode] = useState<'online' | 'in_person'>('in_person')
  const [selectedStores, setSelectedStores] = useState<string[]>([])
  const [contextKeywords, setContextKeywords] = useState('')
  const [joinCode, setJoinCode] = useState('')
  const [myLang, setMyLang] = useState<string>(TRANSLATABLE.has(locale) ? locale : 'zh-TW')
  const [err, setErr] = useState('')
  const [copied, setCopied] = useState(false)

  // ── 檢視模式：bilingual (雙語) / translation_only (只看翻譯) / original_only (只看原文) ──
  const [viewMode, setViewMode] = useState<'bilingual' | 'translation_only' | 'original_only'>('bilingual')

  // ── 聲紋語音包錄音 Modal 狀態 ──
  const [showVoiceModal, setShowVoiceModal] = useState(false)
  const [voiceLang, setVoiceLang] = useState<'zh-TW' | 'vi'>(locale === 'vi' ? 'vi' : 'zh-TW')
  const [isRecordingVoice, setIsRecordingVoice] = useState(false)
  const [voiceAudioUrl, setVoiceAudioUrl] = useState<string | null>(null)
  const [voiceSaving, setVoiceSaving] = useState(false)
  const [voiceSuccess, setVoiceSuccess] = useState(false)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])

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

  // ── 載入使用者與單位/門市元數據 ──
  useEffect(() => {
    let alive = true
    ;(async () => {
      const { data: auth } = await supabase.auth.getUser()
      const user = auth.user
      if (!user || !alive) return
      const { data: profile } = await supabase.from('profiles').select('full_name').eq('id', user.id).single()
      setMe({ id: user.id, name: profile?.full_name || user.email || 'me' })

      // 載入會議元數據（部門、門市、員工聲紋狀態）
      try {
        const res = await fetch(`/api/meeting/meta?locale=${locale}`)
        if (res.ok) {
          const data = await res.json()
          if (!alive) return
          if (Array.isArray(data.departments)) setDepartments(data.departments)
          if (Array.isArray(data.stores)) setStoreList(data.stores)
          if (data.voiceProfile) setVoiceProfile(data.voiceProfile)
          if (data.fixedSentences) setFixedSentences(data.fixedSentences)
          if (data.user?.department) setSelectedDept(data.user.department)
        }
      } catch (e) {
        console.warn('[Meeting] Failed to load meta:', e)
      }
    })()
    return () => { alive = false }
  }, [supabase, locale])

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

  // ── 上下文滑動視窗意譯：把非本語言的逐字翻譯成介面語言 ──
  const [, forceTick] = useState(0)
  useEffect(() => {
    if (!TRANSLATABLE.has(locale) || !meeting) return
    const need = Array.from(
      new Set(lines.filter(l => l.source_lang !== locale).map(l => l.content.trim()).filter(Boolean)),
    ).filter(txt => !transCache.has(tkey(locale, txt)))
    if (!need.length) return
    let alive = true

    // 滑動視窗上下文資料
    const context = {
      title: meeting.title,
      department: meeting.department,
      stores: meeting.stores,
      keywords: meeting.context_keywords,
      participants,
      history: lines.slice(-5).map(l => ({
        speaker: l.speaker_name,
        text: l.content,
        translated: transCache.get(tkey(locale, l.content.trim())),
      })),
    }

    fetch('/api/meeting/translate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ texts: need, target: locale, context }),
    })
      .then(r => r.json())
      .then(d => {
        if (!alive || !Array.isArray(d.translations)) return
        need.forEach((txt, i) => transCache.set(tkey(locale, txt), d.translations[i] ?? txt))
        forceTick(x => x + 1)
      })
      .catch(() => {})
    return () => { alive = false }
  }, [lines, locale, meeting, participants])

  function translatedOf(l: Line): string | null {
    if (l.source_lang === locale || !TRANSLATABLE.has(locale)) return null
    const tr = transCache.get(tkey(locale, l.content.trim()))
    return tr && tr !== l.content.trim() ? tr : null
  }

  // ── 門市切換 ──
  const toggleStore = (code: string) => {
    setSelectedStores(prev =>
      prev.includes(code) ? prev.filter(c => c !== code) : [...prev, code]
    )
  }

  // ── 建立會議 ──
  async function createMeeting() {
    setErr('')
    const deptObj = departments.find(d => d.key === selectedDept)
    const storeNames = selectedStores
      .map(c => storeList.find(s => s.code === c)?.name || c)
      .join(', ')

    // 彙整關鍵字：手動輸入 + 門市名稱
    const combinedKeywords = [
      storeNames,
      contextKeywords.trim(),
    ].filter(Boolean).join(', ')

    const autoTitle = newTitle.trim() || `${deptObj?.label || '營運'}會議${storeNames ? ` (${storeNames})` : ''}`

    const { data, error } = await supabase
      .from('meetings')
      .insert({
        title: autoTitle,
        source_lang: myLang,
        department: selectedDept,
        meeting_mode: selectedMode,
        stores: selectedStores,
        context_keywords: combinedKeywords,
      })
      .select('id, title, room_code, host_id, source_lang, department, meeting_mode, stores, context_keywords')
      .single()

    if (error || !data) {
      console.error('[Meeting] create error:', error)
      setErr(t('createFailed'))
      return
    }

    await supabase.from('meeting_participants').insert({ meeting_id: data.id, name: me?.name ?? '' })
    const m = data as Meeting
    setMeeting(m)
    loadMeetingData(m)
  }

  // ── 加入會議 ──
  async function joinMeeting() {
    setErr('')
    const code = joinCode.trim()
    if (!code) return
    const { data, error } = await supabase.rpc('join_meeting', { p_code: code })
    const row = (Array.isArray(data) ? data[0] : data) as
      | {
          id: string
          title: string
          host_id: string
          source_lang: string
          department?: string
          meeting_mode?: 'online' | 'in_person'
          stores?: string[]
          context_keywords?: string
        }
      | undefined
    if (error || !row) { setErr(t('notFound')); return }
    const m: Meeting = {
      id: row.id,
      title: row.title,
      room_code: code.toUpperCase(),
      host_id: row.host_id,
      source_lang: row.source_lang,
      department: row.department,
      meeting_mode: row.meeting_mode,
      stores: row.stores,
      context_keywords: row.context_keywords,
    }
    setMeeting(m)
    loadMeetingData(m)
  }

  // ── 聲紋語音包錄製流程 ──
  const startVoiceRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      audioChunksRef.current = []
      const mr = new MediaRecorder(stream)
      mr.ondataavailable = e => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data)
      }
      mr.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' })
        const url = URL.createObjectURL(audioBlob)
        setVoiceAudioUrl(url)
        stream.getTracks().forEach(t => t.stop())
      }
      mediaRecorderRef.current = mr
      mr.start()
      setIsRecordingVoice(true)
    } catch {
      alert(t('micDenied'))
    }
  }

  const stopVoiceRecording = () => {
    if (mediaRecorderRef.current && isRecordingVoice) {
      mediaRecorderRef.current.stop()
      setIsRecordingVoice(false)
    }
  }

  const saveVoiceProfile = async () => {
    if (!audioChunksRef.current.length) return
    setVoiceSaving(true)
    try {
      const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' })
      const reader = new FileReader()
      reader.readAsDataURL(audioBlob)
      reader.onloadend = async () => {
        const base64data = reader.result as string
        const fixedText = fixedSentences[voiceLang] || ''

        const res = await fetch('/api/meeting/voice-profile', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            language: voiceLang === 'vi' ? 'vi-VN' : 'zh-TW',
            fixed_text: fixedText,
            audio_url: base64data.slice(0, 100) + '...',
          }),
        })

        if (res.ok) {
          const d = await res.json()
          setVoiceProfile(d.voiceProfile)
          setVoiceSuccess(true)
          setTimeout(() => {
            setShowVoiceModal(false)
            setVoiceSuccess(false)
            setVoiceAudioUrl(null)
          }, 1500)
        } else {
          alert('上傳失敗，請稍後再試')
        }
        setVoiceSaving(false)
      }
    } catch {
      alert('上傳失敗')
      setVoiceSaving(false)
    }
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

  // ── 大廳畫面 ──
  if (!meeting) {
    return (
      <div className="mx-auto max-w-2xl space-y-5 p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
              <Video className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">{t('title')}</h1>
              <p className="text-sm text-muted-foreground">{t('subtitle')}</p>
            </div>
          </div>

          {/* 員工聲紋狀態指示卡 */}
          <button
            onClick={() => setShowVoiceModal(true)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs border transition-colors ${
              voiceProfile?.status === 'enrolled'
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400'
                : 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100 dark:bg-amber-950/40 dark:text-amber-400'
            }`}
          >
            {voiceProfile?.status === 'enrolled' ? (
              <>
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                <span>{t('voiceProfileEnrolled')}</span>
              </>
            ) : (
              <>
                <AlertCircle className="h-3.5 w-3.5 text-amber-600 animate-pulse" />
                <span>{t('voiceProfilePending')}</span>
              </>
            )}
          </button>
        </div>

        {!srSupported && (
          <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-700 dark:bg-amber-950/40 dark:text-amber-400">
            {t('unsupported')}
          </p>
        )}

        <LangPicker value={myLang} onChange={setMyLang} label={t('myLang')} />

        {/* 建立會議表單 */}
        <Card className="space-y-4 p-5">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold">{t('createHeading')}</p>

            {/* 會議模式切換：實體會議 vs 線上會議 */}
            <div className="flex items-center rounded-lg border bg-muted/40 p-0.5 text-xs">
              <button
                type="button"
                onClick={() => setSelectedMode('in_person')}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-md transition-all ${
                  selectedMode === 'in_person'
                    ? 'bg-background font-medium text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <Building2 className="h-3.5 w-3.5" />
                {t('modeInPerson')}
              </button>
              <button
                type="button"
                onClick={() => setSelectedMode('online')}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-md transition-all ${
                  selectedMode === 'online'
                    ? 'bg-background font-medium text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <Video className="h-3.5 w-3.5" />
                {t('modeOnline')}
              </button>
            </div>
          </div>

          <div className="space-y-3">
            {/* 會議主題 */}
            <div>
              <Input
                value={newTitle}
                onChange={e => setNewTitle(e.target.value)}
                placeholder="會議主題（例：河內門市設備報修與夏季物料備貨盤點）"
              />
            </div>

            {/* 主責部門選單 */}
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {departments.map(d => (
                <button
                  key={d.key}
                  type="button"
                  onClick={() => setSelectedDept(d.key)}
                  className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-left text-xs transition-all ${
                    selectedDept === d.key
                      ? 'border-primary bg-primary/10 font-semibold text-primary'
                      : 'border-border bg-background hover:bg-muted/50 text-muted-foreground'
                  }`}
                >
                  <span className="text-sm">{d.icon}</span>
                  <span className="truncate">{d.label}</span>
                </button>
              ))}
            </div>

            {/* 關聯門市選取 */}
            {storeList.length > 0 && (
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                  <Store className="h-3.5 w-3.5" />
                  {t('storesLabel')}
                </label>
                <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto p-1 rounded-md border bg-muted/20">
                  {storeList.map(s => {
                    const active = selectedStores.includes(s.code)
                    return (
                      <button
                        key={s.code}
                        type="button"
                        onClick={() => toggleStore(s.code)}
                        className={`px-2 py-0.5 rounded text-xs transition-all ${
                          active
                            ? 'bg-primary text-primary-foreground font-medium'
                            : 'bg-background border text-muted-foreground hover:bg-muted'
                        }`}
                      >
                        {s.name}
                      </button>
                    )
                  })}
                </div>
              </div>
            )}

            {/* 專有名詞 / 背景關鍵字 */}
            <div>
              <Input
                value={contextKeywords}
                onChange={e => setContextKeywords(e.target.value)}
                placeholder={t('keywordsPh')}
                className="text-xs"
              />
            </div>
          </div>

          <Button onClick={createMeeting} className="w-full gap-1.5">
            <Plus className="h-4 w-4" />{t('create')}
          </Button>
        </Card>

        {/* 加入會議 */}
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

        {/* 員工聲紋語音包錄製 Modal */}
        {showVoiceModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <Card className="max-w-md w-full p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-primary" />
                  <h3 className="font-bold text-base">{t('voiceEnrollTitle')}</h3>
                </div>
                <button onClick={() => setShowVoiceModal(false)} className="text-muted-foreground hover:text-foreground text-sm">✕</button>
              </div>

              <p className="text-xs text-muted-foreground leading-relaxed">
                {t('voiceEnrollDesc')}
              </p>

              {/* 語言選擇 */}
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant={voiceLang === 'zh-TW' ? 'default' : 'outline'}
                  onClick={() => setVoiceLang('zh-TW')}
                  className="flex-1 text-xs"
                >
                  中文語句
                </Button>
                <Button
                  size="sm"
                  variant={voiceLang === 'vi' ? 'default' : 'outline'}
                  onClick={() => setVoiceLang('vi')}
                  className="flex-1 text-xs"
                >
                  Tiếng Việt
                </Button>
              </div>

              {/* 固定朗讀語句 */}
              <div className="rounded-lg border bg-muted/40 p-3 text-sm font-medium leading-relaxed select-none">
                {voiceLang === 'zh-TW'
                  ? (fixedSentences['zh-TW'] || '我是台灣極渴與 FEELING TEA 的夥伴，今天在門市與辦公室參與營運盤點與各部門會議，確認設備與物料品質。')
                  : (fixedSentences['vi'] || 'Tôi là nhân viên của FEELING TEA, hôm nay tham gia cuộc họp vận hành và kiểm kê cửa hàng, xác nhận chất lượng thiết bị và nguyên vật liệu.')}
              </div>

              {/* 錄音操作 */}
              <div className="flex flex-col items-center gap-3 py-2">
                {isRecordingVoice ? (
                  <Button variant="destructive" onClick={stopVoiceRecording} className="gap-2">
                    <span className="h-2 w-2 animate-pulse rounded-full bg-white" />
                    {t('voiceStopRec')}
                  </Button>
                ) : (
                  <Button onClick={startVoiceRecording} className="gap-2">
                    <Mic className="h-4 w-4" />
                    {voiceAudioUrl ? '重新錄製' : t('voiceStartRec')}
                  </Button>
                )}

                {voiceAudioUrl && (
                  <audio src={voiceAudioUrl} controls className="w-full h-9 mt-1" />
                )}
              </div>

              {voiceSuccess ? (
                <p className="text-center text-sm font-semibold text-emerald-600">{t('voiceUploadSuccess')}</p>
              ) : (
                <div className="flex justify-end gap-2 pt-2">
                  <Button variant="outline" onClick={() => setShowVoiceModal(false)} size="sm">取消</Button>
                  <Button onClick={saveVoiceProfile} disabled={!voiceAudioUrl || voiceSaving} size="sm">
                    {voiceSaving ? t('voiceUploading') : t('voiceUpload')}
                  </Button>
                </div>
              )}
            </Card>
          </div>
        )}
      </div>
    )
  }

  // ── 會議進行中畫面 ──
  const isHost = me?.id === meeting.host_id
  const deptObj = departments.find(d => d.key === meeting.department)

  return (
    <div className="mx-auto flex h-full max-w-2xl flex-col gap-3 p-6">
      {/* 頂部會議資訊 */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="truncate text-xl font-bold">{meeting.title || t('title')}</h1>
            {/* 會議模式徽章 */}
            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium border ${
              meeting.meeting_mode === 'in_person'
                ? 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400'
                : 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-400'
            }`}>
              {meeting.meeting_mode === 'in_person' ? <Building2 className="h-3 w-3" /> : <Video className="h-3 w-3" />}
              {meeting.meeting_mode === 'in_person' ? t('modeInPerson') : t('modeOnline')}
            </span>

            {/* 部門徽章 */}
            {deptObj && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] bg-muted border text-muted-foreground">
                <span>{deptObj.icon}</span>
                <span>{deptObj.label}</span>
              </span>
            )}
          </div>

          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <button onClick={copyCode} className="inline-flex items-center gap-1.5 hover:text-foreground">
              <span>{t('roomCode')}：</span>
              <span className="font-mono text-sm font-bold tracking-widest text-foreground">{meeting.room_code}</span>
              <Copy className="h-3.5 w-3.5" />
              {copied && <span className="text-emerald-600">{t('copied')}</span>}
            </button>

            {participants.length > 0 && (
              <span className="flex items-center gap-1">
                <Users className="h-3 w-3" />
                <span>{participants.length} 人</span>
              </span>
            )}
          </div>
        </div>

        <Button variant="ghost" size="sm" onClick={leaveMeeting} className="shrink-0 gap-1.5">
          <LogOut className="h-4 w-4" />{t('leave')}
        </Button>
      </div>

      {/* 實體會議非主持人閱覽模式提醒 */}
      {meeting.meeting_mode === 'in_person' && !isHost && (
        <div className="rounded-lg bg-amber-50/70 border border-amber-200/60 p-2 text-xs text-amber-800 dark:bg-amber-950/30 dark:text-amber-300 flex items-center gap-1.5">
          <Radio className="h-3.5 w-3.5 shrink-0 text-amber-600" />
          <span>{t('inPersonNotice')}</span>
        </div>
      )}

      {/* 控制列：語言選擇、麥克風、視訊、三段式檢視切換 */}
      <div className="flex items-center gap-2 border-y py-2 flex-wrap">
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

        {/* 檢視模式三段式切換 */}
        <div className="flex items-center rounded-lg border bg-muted/40 p-0.5 text-xs ml-auto">
          <button
            type="button"
            onClick={() => setViewMode('bilingual')}
            className={`flex items-center gap-1 px-2 py-0.5 rounded transition-all ${
              viewMode === 'bilingual'
                ? 'bg-background font-medium text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
            title="原文與譯文雙語對照"
          >
            <Languages className="h-3 w-3" />
            <span className="hidden sm:inline">{t('viewBilingual')}</span>
          </button>
          <button
            type="button"
            onClick={() => setViewMode('translation_only')}
            className={`flex items-center gap-1 px-2 py-0.5 rounded transition-all ${
              viewMode === 'translation_only'
                ? 'bg-background font-medium text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
            title="純淨翻譯字幕"
          >
            <Eye className="h-3 w-3" />
            <span className="hidden sm:inline">{t('viewTranslationOnly')}</span>
          </button>
          <button
            type="button"
            onClick={() => setViewMode('original_only')}
            className={`flex items-center gap-1 px-2 py-0.5 rounded transition-all ${
              viewMode === 'original_only'
                ? 'bg-background font-medium text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
            title="純原文紀錄"
          >
            <span className="text-[11px] font-mono">Txt</span>
            <span className="hidden sm:inline">{t('viewOriginalOnly')}</span>
          </button>
        </div>

        {/* 視訊按鈕（線上會議模式才展示） */}
        {JAAS_APP_ID && meeting.meeting_mode === 'online' && (
          <div>
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

      {/* 逐字稿與翻譯輸出區 */}
      <div className="flex-1 space-y-3 overflow-y-auto rounded-lg border p-3">
        {lines.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">{t('empty')}</p>
        ) : (
          lines.map(l => {
            const tr = translatedOf(l)
            const mine = l.speaker_id === me?.id

            return (
              <div key={l.id} className="text-sm border-b pb-2 last:border-b-0">
                <div className="flex items-baseline gap-2">
                  <span className={`font-medium ${mine ? 'text-blue-600 dark:text-blue-400' : 'text-foreground'}`}>
                    {mine ? t('you') : (l.speaker_name || '—')}
                  </span>
                  <span className="text-[11px] text-muted-foreground">{fmtTime(l.created_at)}</span>
                  {l.source_lang && (
                    <span className="text-[10px] text-muted-foreground/60 uppercase">({l.source_lang})</span>
                  )}
                </div>

                {/* 純原文模式 */}
                {viewMode === 'original_only' && (
                  <p className="mt-0.5 whitespace-pre-wrap break-words">{l.content}</p>
                )}

                {/* 純翻譯模式 */}
                {viewMode === 'translation_only' && (
                  <p className="mt-0.5 whitespace-pre-wrap break-words text-foreground font-normal">
                    {tr || l.content}
                  </p>
                )}

                {/* 雙語對照模式（預設） */}
                {viewMode === 'bilingual' && (
                  <>
                    <p className="mt-0.5 whitespace-pre-wrap break-words">{l.content}</p>
                    {tr && (
                      <p className="mt-1 whitespace-pre-wrap break-words text-[13px] text-blue-700 dark:text-blue-300 bg-blue-50/70 dark:bg-blue-950/40 px-2.5 py-1.5 rounded-md border border-blue-100 dark:border-blue-900/30">
                        ↳ {tr}
                      </p>
                    )}
                  </>
                )}
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
