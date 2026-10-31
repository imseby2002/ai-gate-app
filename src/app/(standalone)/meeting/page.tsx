'use client'

import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { useTranslations, useLocale } from 'next-intl'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import {
  Mic, MicOff, Copy, LogOut, Plus, Users, Video, VideoOff,
  Building2, Store, CheckCircle2, AlertCircle, Languages,
  Sparkles, Radio, Eye, Loader2, Download, History, Trash2,
  Globe, UserCheck, X, MessageSquare, UserPlus
} from 'lucide-react'
import { MeetingVideo } from '@/components/meeting/MeetingVideo'
import { MeetingChat } from '@/components/meeting/MeetingChat'
import { GuestInviteDialog } from '@/components/meeting/GuestInviteDialog'
import { MeetingViewerGrants } from '@/components/meeting/MeetingViewerGrants'
import {
  fetchAzureSpeechToken, preloadAzureSpeechSdk, startAzureRecognition,
  type AzureRecognitionController, type AzureSpeechToken,
} from '@/lib/meeting/azure-speech'

// 解析講者別名與合併對映（支援鏈式合併）
function resolveSpeakerDisplayName(rawSpeaker: string, aliases: Record<string, string>): string {
  if (!rawSpeaker) return ''
  let curr = rawSpeaker
  const visited = new Set<string>()
  while (aliases[curr] && !visited.has(curr)) {
    visited.add(curr)
    curr = aliases[curr]
  }
  return curr || rawSpeaker
}

// ── 型別 ──────────────────────────────────────────────────────────
interface Me { id: string; name: string }
interface Meeting {
  id: string
  title: string
  room_code: string
  host_id: string
  source_lang: string
  department?: string
  departments?: string[]
  meeting_mode?: 'online' | 'in_person'
  stores?: string[]
  context_keywords?: string
  created_at?: string
  /** 其他會出現的語言；null = 舊會議（沿用中/越/英自動偵測） */
  other_langs?: string[] | null
  /** 列表 API 帶入：主持人姓名、我的角色（viewer＝只能瀏覽：公司管理者或被授權） */
  host_name?: string
  role?: 'host' | 'participant' | 'viewer'
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

interface Line {
  id: string
  speaker_id: string
  speaker_name: string
  content: string
  source_lang: string
  created_at: string
}

// 支援的語音輸入語言（包括 Azure 自動偵測）
const INPUT_LANGS: { code: string; label: string; sr: string }[] = [
  { code: 'auto', label: '會議語言（自動偵測）', sr: 'zh-TW' },
  { code: 'zh-TW', label: '繁體中文', sr: 'zh-TW' },
  { code: 'vi', label: 'Tiếng Việt', sr: 'vi-VN' },
  { code: 'en', label: 'English', sr: 'en-US' },
]

// 支援的翻譯目標語言
const TARGET_LANGS: { code: string; label: string }[] = [
  { code: 'zh-TW', label: '繁體中文' },
  { code: 'vi', label: 'Tiếng Việt' },
  { code: 'en', label: 'English' },
]

// 翻譯下拉選項：預設不翻譯 (純原文)，需要時手動調整
const TRANSLATION_TARGET_OPTIONS: { code: string; label: string }[] = [
  { code: 'none', label: '不翻譯 (純原文)' },
  { code: 'zh-TW', label: '繁體中文' },
  { code: 'vi', label: 'Tiếng Việt' },
  { code: 'en', label: 'English' },
]

const TRANSLATABLE = new Set(['zh-TW', 'vi', 'en'])

// 會議語言：主要語言在前，其後為其他會出現的語言
function meetingLangs(m: Pick<Meeting, 'source_lang' | 'other_langs'>): string[] {
  const primary = TRANSLATABLE.has(m.source_lang) ? m.source_lang : 'zh-TW'
  const others = m.other_langs ?? TARGET_LANGS.map(l => l.code)
  return [primary, ...others.filter(l => l !== primary && TRANSLATABLE.has(l))]
}

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

// ── 翻譯快取（跨元件共用）──────────────────────────────────────────
const transCache = new Map<string, string>()
const tkey = (locale: string, text: string) => `${locale}:${text}`

// 語言特徵判斷（防範 Azure 語音辨識語言自動判斷失準或回退為主要語言）
const VI_CHAR_REGEX = /[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]/i
const ZH_CHAR_REGEX = /[\u4e00-\u9fa5]/

function isTranslatableLine(l: { content: string; source_lang: string }, target: string): boolean {
  if (!TRANSLATABLE.has(target)) return false
  const txt = l.content.trim()
  if (!txt) return false
  if (l.source_lang !== target) return true
  // 語言標籤與目標語言相同，但字面上明顯屬於另一語言（例如標記為中文但內容實為越文）
  if (target === 'zh-TW' && VI_CHAR_REGEX.test(txt)) return true
  if (target === 'vi' && ZH_CHAR_REGEX.test(txt)) return true
  return false
}

function fmtDate(iso: string) {
  const d = new Date(iso)
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`
}

// 會議代碼存在網址（?room=），頁面重新載入或新版部署後可自動回到同一場會議
function setRoomParam(code: string | null) {
  if (typeof window === 'undefined') return
  const url = new URL(window.location.href)
  if (code) url.searchParams.set('room', code)
  else url.searchParams.delete('room')
  window.history.replaceState(window.history.state, '', url.toString())
}

// Azure 連線中斷時的重試次數上限（超過才改用瀏覽器語音辨識）
const AZURE_MAX_RETRIES = 5

function fmtTime(iso: string) {
  const d = new Date(iso)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

export default function MeetingPage() {
  const t = useTranslations('Meeting')
  const tr = useTranslations('MeetingRoom')
  const locale = useLocale()
  // createClient() 回傳單例，直接取用即可（不需 useRef，避免 render 期存取 ref）
  const supabase = createClient()

  const [me, setMe] = useState<Me | null>(null)
  const [meeting, setMeeting] = useState<Meeting | null>(null)
  const [lines, setLines] = useState<Line[]>([])
  // 定時同步只抓最新一筆之後的逐字稿（逐字稿只會新增），不再每 6 秒重抓整份
  const latestLineAtRef = useRef<string | null>(null)
  useEffect(() => { latestLineAtRef.current = lines.length ? lines[lines.length - 1].created_at : null }, [lines])
  const [participants, setParticipants] = useState<string[]>([])

  const [departments, setDepartments] = useState<DeptOption[]>([])
  const [storeList, setStoreList] = useState<StoreOption[]>([])
  const [newTitle, setNewTitle] = useState('')
  const [selectedDepts, setSelectedDepts] = useState<string[]>(['store'])
  const [selectedMode, setSelectedMode] = useState<'online' | 'in_person'>('in_person')
  const [selectedStores, setSelectedStores] = useState<string[]>([])
  const [contextKeywords, setContextKeywords] = useState('')
  const [joinCode, setJoinCode] = useState('')
  const [history, setHistory] = useState<Meeting[]>([])
  const [downloading, setDownloading] = useState(false)
  const [interim, setInterim] = useState<{ text: string; speaker?: string } | null>(null)
  const [speakerAliases, setSpeakerAliases] = useState<Record<string, string>>({})

  // ── 實體現場會議：人數上限與講者設定 ──
  const [expectedSpeakers, setExpectedSpeakers] = useState<number>(3)
  const expectedSpeakersRef = useRef<number>(3)
  const [speakerNamesInput, setSpeakerNamesInput] = useState<string>('')
  const [speakerModalOpen, setSpeakerModalOpen] = useState(false)
  const [speakerModalActiveTab, setSpeakerModalActiveTab] = useState<string | null>(null)

  const handleSpeakerCountChange = (count: number) => {
    const valid = Math.max(1, Math.min(36, count))
    setExpectedSpeakers(valid)
    expectedSpeakersRef.current = valid
    if (azureControllerRef.current?.setMaxSpeakers) {
      azureControllerRef.current.setMaxSpeakers(valid)
    }
  }

  const handleSetSpeakerAlias = (speakerId: string, alias: string) => {
    const trimmed = alias.trim()
    setSpeakerAliases(prev => {
      const next = { ...prev }
      if (trimmed && trimmed !== speakerId) {
        next[speakerId] = trimmed
      } else {
        delete next[speakerId]
      }
      return next
    })
  }

  const handleMergeSpeaker = (sourceSpeaker: string, targetSpeaker: string) => {
    if (!sourceSpeaker || !targetSpeaker || sourceSpeaker === targetSpeaker) return
    setSpeakerAliases(prev => ({
      ...prev,
      [sourceSpeaker]: targetSpeaker,
    }))
  }

  const handleUnmergeSpeaker = (sourceSpeaker: string) => {
    setSpeakerAliases(prev => {
      const next = { ...prev }
      delete next[sourceSpeaker]
      return next
    })
  }

  // 統計所有出現過的現場講者與其發言次數
  const { modalSpeakerList, speakerCountMap } = useMemo(() => {
    const counts: Record<string, number> = {}
    const set = new Set<string>()

    // 預設列出 講者 1..expectedSpeakers
    for (let i = 1; i <= Math.max(expectedSpeakers, 2); i++) {
      set.add(`講者 ${i}`)
    }

    // 匯總 lines 中出現過的講者
    lines.forEach(l => {
      if (meeting?.meeting_mode === 'in_person' && l.speaker_id !== meeting?.host_id) return
      const s = l.speaker_name || '講者 1'
      counts[s] = (counts[s] || 0) + 1
      if (s.startsWith('講者') || s.startsWith('Speaker') || s.startsWith('Guest')) {
        set.add(s)
      }
    })

    const list = Array.from(set).sort((a, b) => {
      const numA = parseInt(a.match(/\d+/)?.[0] || '999', 10)
      const numB = parseInt(b.match(/\d+/)?.[0] || '999', 10)
      return numA - numB
    }).map(id => ({ id }))

    return { modalSpeakerList: list, speakerCountMap: counts }
  }, [lines, expectedSpeakers, meeting])

  const toggleDept = (key: string) => {
    setSelectedDepts(prev =>
      prev.includes(key)
        ? (prev.length > 1 ? prev.filter(k => k !== key) : prev)
        : [...prev, key]
    )
  }

  // 辨識輸入語言（預設 auto，支援中/越/英自動偵測）與翻譯目標語言（預設不翻譯，由使用者手動開啟）
  const [inputLang, setInputLang] = useState<string>('auto')
  // 建立會議：主要語言（單選）與其他會出現的語言（多選）
  const [primaryLang, setPrimaryLang] = useState<string>(TRANSLATABLE.has(locale) ? locale : 'zh-TW')
  const [otherLangs, setOtherLangs] = useState<string[]>([])
  const [targetLang, setTargetLang] = useState<string>('none')
  const [err, setErr] = useState('')
  const [creating, setCreating] = useState(false)
  const [joining, setJoining] = useState(false)
  const [copied, setCopied] = useState(false)

  // ── 檢視模式：bilingual (雙語) / translation_only (只看翻譯) / original_only (只看原文) ──
  const [viewMode, setViewMode] = useState<'bilingual' | 'translation_only' | 'original_only'>('bilingual')

  const [recording, setRecording] = useState(false)
  const [speechEngine, setSpeechEngine] = useState<'azure' | 'web_speech' | null>(null)
  const [micDenied, setMicDenied] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  const srSupported = mounted && typeof window !== 'undefined' && (!!getSRCtor() || !!navigator?.mediaDevices)

  const azureControllerRef = useRef<AzureRecognitionController | null>(null)
  const azureRetryRef = useRef(0)
  const azureTokenRef = useRef<{ data: AzureSpeechToken; at: number } | null>(null)
  const speechEngineRef = useRef<'azure' | 'web_speech' | null>(null)
  const autoJoinTriedRef = useRef(false)
  const recRef = useRef<SpeechRec | null>(null)
  const recordingRef = useRef(false)
  const restartTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const wakeLockRef = useRef<{ release: () => Promise<void> | void } | null>(null)
  const audioKeepAliveRef = useRef<AudioContext | null>(null)
  const lastActiveRef = useRef<number>(Date.now())
  const bottomRef = useRef<HTMLDivElement | null>(null)
  const inFlightRef = useRef<Set<string>>(new Set())

  // 視訊（有設定 JaaS 用 JaaS，否則內建 WebRTC）、訪客邀請、聊天
  const [video, setVideo] = useState(false)
  const [showChat, setShowChat] = useState(false)
  const [inviteOpen, setInviteOpen] = useState(false)

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
          if (data.user?.department) setSelectedDepts([data.user.department])
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

  // ── 進入會議：記住代碼、預載 Azure SDK 與 token，按下錄音即可立即開始 ──
  useEffect(() => {
    if (!meeting) return
    setRoomParam(meeting.room_code)
    void preloadAzureSpeechSdk().catch(() => {})
    void fetchAzureSpeechToken().then(data => {
      if (data.configured) azureTokenRef.current = { data, at: Date.now() }
    })
  }, [meeting])

  // ── 錄音中離開／重新整理頁面前提醒 ──
  useEffect(() => {
    if (!recording) return
    const onBeforeUnload = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = '' }
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [recording])

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
        let q = supabase
          .from('meeting_lines')
          .select('*')
          .eq('meeting_id', meeting.id)
        // 往前多抓 30 秒，涵蓋較晚送達但時間較早的發言；重複的以 id 去重
        const after = latestLineAtRef.current
        if (after) q = q.gte('created_at', new Date(new Date(after).getTime() - 30_000).toISOString())
        const { data: latest } = await q.order('created_at', { ascending: true })

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

  // ── 上下文滑動視窗意譯：把非目標語言的發言翻譯成所選 targetLang ──
  const [tick, forceTick] = useState(0)
  useEffect(() => {
    if (!TRANSLATABLE.has(targetLang) || !meeting) return

    // 找出尚未翻譯且未在處理佇列中的句子
    const need = Array.from(
      new Set(
        lines
          .filter(l => isTranslatableLine(l, targetLang))
          .map(l => l.content.trim())
          .filter(Boolean),
      ),
    ).filter(txt => !transCache.has(tkey(targetLang, txt)) && !inFlightRef.current.has(tkey(targetLang, txt)))

    if (!need.length) return

    // 單次發送最多 8 句，平滑佇列避免雪崩與截斷
    const batch = need.slice(0, 8)
    batch.forEach(txt => inFlightRef.current.add(tkey(targetLang, txt)))

    const meetingDeptLabels = (
      meeting.departments?.length
        ? meeting.departments
        : (meeting.department ? meeting.department.split(',') : [])
    ).map(k => departments.find(d => d.key === k)?.label || k).join('、')

    // 滑動視窗上下文資料
    const context = {
      title: meeting.title,
      department: meetingDeptLabels || meeting.department,
      stores: meeting.stores,
      keywords: meeting.context_keywords,
      participants,
      history: lines.slice(-5).map(l => ({
        speaker: l.speaker_name,
        text: l.content,
        translated: transCache.get(tkey(targetLang, l.content.trim())),
      })),
    }

    fetch('/api/meeting/translate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ texts: batch, target: targetLang, context }),
    })
      .then(r => r.json())
      .then(d => {
        if (Array.isArray(d?.translations)) {
          batch.forEach((txt, i) => {
            const tr = d.translations[i]
            // 只有成功取得不同於原文的非空字串才寫入快取，防止失敗時把原文毒化進快取
            if (typeof tr === 'string' && tr.trim() && tr.trim() !== txt) {
              transCache.set(tkey(targetLang, txt), tr.trim())
            }
          })
          forceTick(x => x + 1)
        }
      })
      .catch(err => {
        console.warn('[Meeting] translate request failed:', err)
      })
      .finally(() => {
        batch.forEach(txt => inFlightRef.current.delete(tkey(targetLang, txt)))
        // 若還有未處理的句子，觸發下一個 batch
        forceTick(x => x + 1)
      })
  }, [lines, targetLang, meeting, participants, departments, tick])

  function translatedOf(l: Line): string | null {
    if (!isTranslatableLine(l, targetLang)) return null
    const tr = transCache.get(tkey(targetLang, l.content.trim()))
    return tr && tr !== l.content.trim() ? tr : null
  }

  // ── 網址帶有 ?room=：自動回到該場會議（重新整理、新版部署或分頁被系統回收後）──
  useEffect(() => {
    if (!me || meeting || autoJoinTriedRef.current) return
    autoJoinTriedRef.current = true
    const code = new URLSearchParams(window.location.search).get('room')
    if (code) void joinMeeting(code)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [me, meeting])

  // ── 大廳：我主持或參加過的會議 ──
  useEffect(() => {
    if (meeting || !me) return
    fetch('/api/meeting/list').then(r => r.ok ? r.json() : { meetings: [] })
      .then((j: { meetings?: Meeting[] }) => setHistory(j.meetings ?? []))
      .catch(() => {})
  }, [meeting, me])

  // 主持人：刪除整場會議（含逐字稿）；其他參與者：從自己的紀錄移除
  async function deleteMeeting(m: Meeting) {
    const isHost = m.host_id === me?.id
    if (!confirm(isHost ? t('confirmDelete', { title: m.title || m.room_code }) : t('confirmRemove', { title: m.title || m.room_code }))) return
    const { error } = isHost
      ? await supabase.from('meetings').delete().eq('id', m.id)
      : await supabase.from('meeting_participants').delete().eq('meeting_id', m.id).eq('user_id', me?.id ?? '')
    if (error) { setErr(t('deleteFailed')); return }
    setHistory(h => h.filter(x => x.id !== m.id))
  }

  // 進入會議；依需求預設維持不翻譯，由使用者在會議中手動按需開啟
  function enterMeeting(m: Meeting) {
    setMeeting(m)
    loadMeetingData(m)
  }

  function openMeeting(m: Meeting) {
    setErr('')
    enterMeeting(m)
  }

  // ── 下載會議紀錄（原文＋譯文） ──
  async function downloadRecord() {
    if (!meeting) return
    setDownloading(true)
    try {
      const need = Array.from(new Set(
        lines.filter(l => isTranslatableLine(l, targetLang)).map(l => l.content.trim()).filter(Boolean),
      )).filter(txt => !transCache.has(tkey(targetLang, txt)))
      for (let i = 0; i < need.length; i += 8) {
        const chunk = need.slice(i, i + 8)
        try {
          const r = await fetch('/api/meeting/translate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ texts: chunk, target: targetLang, context: { title: meeting.title, keywords: meeting.context_keywords } }),
          })
          const d = await r.json()
          if (Array.isArray(d?.translations)) {
            chunk.forEach((txt, j) => {
              const tr = d.translations[j]
              if (typeof tr === 'string' && tr.trim() && tr.trim() !== txt) {
                transCache.set(tkey(targetLang, txt), tr.trim())
              }
            })
          }
        } catch {}
      }
      const langLabel = TRANSLATION_TARGET_OPTIONS.find(l => l.code === targetLang)?.label ?? ''
      const head = [
        `${t('title')}：${meeting.title || '—'}`,
        `${t('roomCode')}：${meeting.room_code}`,
        meeting.created_at ? `${t('date')}：${fmtDate(meeting.created_at)}` : '',
        participants.length ? `${t('participants')}：${participants.join('、')}` : '',
        targetLang !== 'none' ? `${t('translateTo')}：${langLabel}` : '',
      ].filter(Boolean)
      const body = lines.map(l => {
        const tr = translatedOf(l)
        const isRemote = meeting.meeting_mode === 'in_person' && l.speaker_id !== meeting.host_id
        const rawSpeaker = l.speaker_name || (meeting.meeting_mode === 'in_person' ? '講者 1' : '')
        const speaker = isRemote
          ? `${l.speaker_name || '遠端成員'} (遠端)`
          : (resolveSpeakerDisplayName(rawSpeaker, speakerAliases) || rawSpeaker || '—')
        const first = `[${fmtDate(l.created_at)} ${fmtTime(l.created_at)}] ${speaker}：${l.content}`
        return tr ? `${first}\n    ↳ ${tr}` : first
      })
      const blob = new Blob(['\ufeff' + [...head, '', ...body].join('\n') + '\n'], { type: 'text/plain;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${t('title')}_${(meeting.title || meeting.room_code).replace(/[\\/:*?"<>|]/g, '_')}_${meeting.created_at ? fmtDate(meeting.created_at).replace(/\//g, '') : meeting.room_code}.txt`
      a.click()
      URL.revokeObjectURL(url)
    } finally {
      setDownloading(false)
    }
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
    setCreating(true)
    try {
      // 實體會議：若有預先輸入現場人員名單，自動映射為 講者 1, 講者 2...
      if (selectedMode === 'in_person' && speakerNamesInput.trim()) {
        const parsedNames = speakerNamesInput
          .split(/[,，\n]/)
          .map(s => s.trim())
          .filter(Boolean)
        const initialAliases: Record<string, string> = {}
        parsedNames.forEach((name, idx) => {
          initialAliases[`講者 ${idx + 1}`] = name
        })
        setSpeakerAliases(prev => ({ ...prev, ...initialAliases }))
      }
      const selectedDeptObjs = departments.filter(d => selectedDepts.includes(d.key))
      const deptLabels = selectedDeptObjs.map(d => d.label).join('、')
      const storeNames = selectedStores
        .map(c => storeList.find(s => s.code === c)?.name || c)
        .join(', ')

      // 彙整關鍵字：手動輸入 + 門市名稱 + 跨部門名稱
      const combinedKeywords = [
        deptLabels ? `跨部門領域: ${deptLabels}` : '',
        storeNames,
        contextKeywords.trim(),
      ].filter(Boolean).join(', ')

      const autoTitle = newTitle.trim() || `${deptLabels || '跨部門'}會議${storeNames ? ` (${storeNames})` : ''}`

      const res = await fetch('/api/meeting/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: autoTitle,
          source_lang: primaryLang,
          other_langs: otherLangs.filter(l => l !== primaryLang),
          department: selectedDepts.join(','),
          departments: selectedDepts,
          meeting_mode: selectedMode,
          stores: selectedStores,
          context_keywords: combinedKeywords,
        }),
      })

      const json = await res.json().catch(() => ({}))
      if (!res.ok || !json.meeting) {
        setErr(json.error || t('createFailed'))
        return
      }

      const createdRow = json.meeting as Meeting
      enterMeeting(createdRow)
    } catch (e: unknown) {
      console.error('[Meeting] createMeeting failed:', e)
      setErr(e instanceof Error ? e.message : t('createFailed'))
    } finally {
      setCreating(false)
    }
  }

  // ── 加入會議 ──
  async function joinMeeting(codeOverride?: string) {
    setErr('')
    const code = (codeOverride ?? joinCode).trim().toUpperCase()
    if (!code) return

    setJoining(true)
    try {
      const res = await fetch('/api/meeting/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code }),
      })

      const json = await res.json().catch(() => ({}))
      if (!res.ok || !json.meeting) {
        setErr(json.error || t('notFound'))
        if (codeOverride) setRoomParam(null)
        return
      }

      const m: Meeting = {
        id: String(json.meeting.id),
        title: String(json.meeting.title || ''),
        room_code: code,
        host_id: String(json.meeting.host_id || ''),
        source_lang: String(json.meeting.source_lang || 'zh-TW'),
        department: json.meeting.department as string | undefined,
        departments: json.meeting.departments as string[] | undefined,
        meeting_mode: json.meeting.meeting_mode as 'online' | 'in_person' | undefined,
        stores: json.meeting.stores as string[] | undefined,
        context_keywords: json.meeting.context_keywords as string | undefined,
        created_at: json.meeting.created_at as string | undefined,
        other_langs: (json.meeting.other_langs ?? null) as string[] | null,
      }
      enterMeeting(m)
    } catch (e: unknown) {
      console.error('[Meeting] joinMeeting failed:', e)
      setErr(e instanceof Error ? e.message : t('notFound'))
    } finally {
      setJoining(false)
    }
  }

  // ── 麥克風辨識寫入資料庫 ──
  const addLine = useCallback(async (text: string, speakerName?: string, lang?: string) => {
    const clean = text.trim()
    if (!clean || !meeting) return

    const finalSpeaker = speakerName || me?.name || ''
    const finalLang = lang || (inputLang === 'auto' ? meetingLangs(meeting)[0] : inputLang)

    try {
      let { data, error } = await supabase
        .from('meeting_lines')
        .insert({
          meeting_id: meeting.id,
          speaker_name: finalSpeaker,
          content: clean,
          source_lang: finalLang,
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
            speaker_name: finalSpeaker,
            content: clean,
            source_lang: finalLang,
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
  }, [supabase, meeting, me, inputLang])

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
      // 瀏覽器辨識一次只能聽一種語言：自動模式用會議主要語言
      const lang = inputLang === 'auto' && meeting ? meetingLangs(meeting)[0] : inputLang
      rec.lang = INPUT_LANGS.find(l => l.code === lang)?.sr ?? 'zh-TW'
      rec.continuous = true
      rec.interimResults = true

      rec.onresult = (e: SREvent) => {
        lastActiveRef.current = Date.now()
        let pending = ''
        for (let i = e.resultIndex; i < e.results.length; i++) {
          const r = e.results[i]
          if (r.isFinal) void addLine(r[0].transcript)
          else pending += r[0].transcript
        }
        setInterim(pending.trim() ? { text: pending.trim() } : null)
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
  }, [cleanupRec, inputLang, addLine, meeting])

  const startWebSpeech = useCallback(() => {
    speechEngineRef.current = 'web_speech'
    setSpeechEngine('web_speech')
    startRecognizerInstance()
  }, [startRecognizerInstance])

  // 啟動 Azure；連線中斷時以新 token 重連，連續失敗超過上限才改用瀏覽器語音辨識
  const startAzure = useCallback(async (): Promise<boolean> => {
    try {
      const cached = azureTokenRef.current
      const tokenData = cached && Date.now() - cached.at < 8 * 60 * 1000
        ? cached.data
        : await fetchAzureSpeechToken()
      azureTokenRef.current = null
      if (!tokenData.configured || !tokenData.token || !tokenData.region) return false
      if (!recordingRef.current) return true

      const ctrl = await startAzureRecognition({
        token: tokenData.token,
        region: tokenData.region,
        mode: meeting?.meeting_mode || 'online',
        languages: inputLang === 'auto' && meeting ? meetingLangs(meeting) : [inputLang],
        maxSpeakers: expectedSpeakersRef.current || expectedSpeakers,
        onInterim: (text, speaker) => {
          lastActiveRef.current = Date.now()
          setInterim({ text, speaker })
        },
        onRecognized: (text, speakerLabel, detectedLang) => {
          lastActiveRef.current = Date.now()
          azureRetryRef.current = 0
          setInterim(null)
          void addLine(text, speakerLabel, detectedLang)
        },
        onError: (err) => {
          azureControllerRef.current = null
          setInterim(null)
          if (!recordingRef.current) return
          const attempt = ++azureRetryRef.current
          if (attempt > AZURE_MAX_RETRIES) {
            console.warn('[Meeting] Azure Speech failed repeatedly, fallback to Web Speech:', err)
            startWebSpeech()
            return
          }
          console.warn(`[Meeting] Azure Speech disconnected, reconnecting (${attempt}/${AZURE_MAX_RETRIES}):`, err)
          if (restartTimerRef.current) clearTimeout(restartTimerRef.current)
          restartTimerRef.current = setTimeout(() => {
            if (!recordingRef.current) return
            void startAzure().then(ok => { if (!ok && recordingRef.current) startWebSpeech() })
          }, Math.min(1000 * attempt, 5000))
        },
      })
      if (!recordingRef.current) {
        void ctrl.stop()
        return true
      }
      azureControllerRef.current = ctrl
      speechEngineRef.current = 'azure'
      setSpeechEngine('azure')
      return true
    } catch (e) {
      console.warn('[Meeting] Azure Speech start failed:', e)
      return false
    }
  }, [meeting, inputLang, addLine, startWebSpeech])

  const startRec = useCallback(async () => {
    setMicDenied(false)
    recordingRef.current = true
    setRecording(true)
    lastActiveRef.current = Date.now()
    azureRetryRef.current = 0

    // 請求 Screen Wake Lock 避免會議期間因螢幕休眠被作業系統凍結（不阻塞錄音啟動）
    if (typeof navigator !== 'undefined' && 'wakeLock' in navigator) {
      void (navigator as unknown as { wakeLock: { request: (t: string) => Promise<{ release: () => Promise<void> }> } }).wakeLock
        .request('screen')
        .then(lock => { wakeLockRef.current = lock })
        .catch(() => {})
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

    // 先嘗試 Azure AI 語音識別與多人聲紋分離；未配置或建立失敗則降級為瀏覽器 Web Speech API
    if (await startAzure()) return
    if (recordingRef.current) startWebSpeech()
  }, [startAzure, startWebSpeech])

  const stopRec = useCallback(() => {
    recordingRef.current = false
    setRecording(false)
    setSpeechEngine(null)
    speechEngineRef.current = null
    setInterim(null)
    if (azureControllerRef.current) {
      void azureControllerRef.current.stop()
      azureControllerRef.current = null
    }
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
      // 僅在 Web Speech API 模式下需要看門狗定時檢查重啟
      if (speechEngineRef.current === 'web_speech') {
        const idle = Date.now() - lastActiveRef.current
        if (idle > 45000) {
          console.log('[Meeting] Watchdog: recognition idle > 45s, refreshing instance...')
          startRecognizerInstance()
        }
      }
    }, 10000)

    const handleVisibility = () => {
      if (document.visibilityState === 'visible' && recordingRef.current && speechEngineRef.current === 'web_speech') {
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

  function stopVideo() {
    setVideo(false)
  }

  function leaveMeeting() {
    stopRec()
    stopVideo()
    setRoomParam(null)
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
        </div>

        {!srSupported && (
          <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-700 dark:bg-amber-950/40 dark:text-amber-400">
            {t('unsupported')}
          </p>
        )}

        {/* 翻譯目標語言 */}
        <div className="flex items-center gap-3 flex-wrap p-3 rounded-lg border bg-muted/20">
          <LangPicker
            value={targetLang}
            onChange={setTargetLang}
            label={t('targetLangLabel')}
            options={TRANSLATION_TARGET_OPTIONS}
            compact
            icon={<Languages className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />}
          />
        </div>

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

            {/* 實體現場會議設定：人數限制與現場人員名單 */}
            {selectedMode === 'in_person' && (
              <div className="rounded-lg border border-amber-200/70 bg-amber-50/40 p-3 space-y-3 dark:border-amber-900/40 dark:bg-amber-950/20">
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-amber-900 dark:text-amber-200 flex items-center gap-1.5">
                      <Users className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
                      現場預計與會人數
                    </label>
                    <span className="text-[11px] font-semibold text-amber-800 dark:text-amber-300 bg-amber-100/70 dark:bg-amber-900/40 px-2.5 py-0.5 rounded-full border border-amber-300/60 dark:border-amber-800/60">
                      目前選定：{expectedSpeakers} 人
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {[2, 3, 4, 5, 6, 8, 10, 12].map(num => (
                      <button
                        key={num}
                        type="button"
                        onClick={() => handleSpeakerCountChange(num)}
                        className={`px-3 py-1.5 rounded-md text-xs font-medium border transition-all ${
                          expectedSpeakers === num
                            ? 'border-amber-600 bg-amber-600 text-white shadow-sm font-bold'
                            : 'border-amber-200 bg-background text-foreground hover:bg-amber-100/50 dark:border-amber-900/60'
                        }`}
                      >
                        {num} 人 {num === 3 && <span className="text-[10px] opacity-80">(預設)</span>}
                      </button>
                    ))}
                    <div className="flex items-center gap-1 ml-auto text-xs text-amber-900 dark:text-amber-200">
                      <span>自訂：</span>
                      <input
                        type="number"
                        min={1}
                        max={36}
                        value={expectedSpeakers}
                        onChange={e => handleSpeakerCountChange(parseInt(e.target.value, 10) || 1)}
                        className="w-14 h-7 text-center rounded border bg-background text-xs font-bold text-foreground focus:outline-none focus:ring-1 focus:ring-amber-500"
                      />
                      <span>人</span>
                    </div>
                  </div>
                  <p className="text-[11px] text-amber-700/80 dark:text-amber-400/70">
                    💡 聲紋分離最高支援 36 人。設定現場人數後，系統將嚴格約束在此人數內，防止一人說話因距離或換氣被誤判為多人。
                  </p>
                </div>

                <div className="space-y-1.5 pt-1 border-t border-amber-200/50 dark:border-amber-900/30">
                  <label className="text-xs font-semibold text-amber-900 dark:text-amber-200 flex items-center gap-1.5">
                    <UserCheck className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
                    現場人員姓名預設（選填）
                  </label>
                  <Input
                    value={speakerNamesInput}
                    onChange={e => setSpeakerNamesInput(e.target.value)}
                    placeholder="例如：王廠長, 阮助理, 陳主任（以逗號分隔）"
                    className="text-xs bg-background"
                  />
                  {speakerNamesInput.trim() && (
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {speakerNamesInput
                        .split(/[,，\n]/)
                        .map(s => s.trim())
                        .filter(Boolean)
                        .map((name, idx) => (
                          <span
                            key={idx}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] bg-amber-100 text-amber-900 dark:bg-amber-900/50 dark:text-amber-200 border border-amber-300 dark:border-amber-800"
                          >
                            <span className="font-mono text-[10px] opacity-70">講者 {idx + 1} ➜</span>
                            <span className="font-semibold">{name}</span>
                          </span>
                        ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* 會議語言：主要語言（單選）＋其他會出現的語言（多選） */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                <Languages className="h-3.5 w-3.5" />
                {t('primaryLangLabel')}
              </label>
              <div className="flex flex-wrap gap-1.5">
                {TARGET_LANGS.map(l => (
                  <button
                    key={l.code}
                    type="button"
                    onClick={() => {
                      setPrimaryLang(l.code)
                      setOtherLangs(prev => prev.filter(x => x !== l.code))
                    }}
                    className={`px-3 py-1 rounded-md text-xs border transition-all ${
                      primaryLang === l.code
                        ? 'border-primary bg-primary text-primary-foreground font-medium'
                        : 'bg-background text-muted-foreground hover:bg-muted'
                    }`}
                  >
                    {l.label}
                  </button>
                ))}
              </div>
              <label className="text-xs font-medium text-muted-foreground block pt-1">
                {t('otherLangsLabel')}
              </label>
              <div className="flex flex-wrap gap-1.5">
                {TARGET_LANGS.filter(l => l.code !== primaryLang).map(l => {
                  const active = otherLangs.includes(l.code)
                  return (
                    <button
                      key={l.code}
                      type="button"
                      onClick={() => setOtherLangs(prev => (active ? prev.filter(x => x !== l.code) : [...prev, l.code]))}
                      className={`flex items-center gap-1 px-3 py-1 rounded-md text-xs border transition-all ${
                        active
                          ? 'border-primary bg-primary/10 font-medium text-primary'
                          : 'bg-background text-muted-foreground hover:bg-muted'
                      }`}
                    >
                      {active && <CheckCircle2 className="h-3 w-3" />}
                      {l.label}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* 主責與跨部門選單（支援多選） */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                  <Building2 className="h-3.5 w-3.5" />
                  {t('deptLabel')}
                  <span className="text-[11px] text-muted-foreground/80">（可複選跨部門）</span>
                </label>
                {selectedDepts.length > 1 && (
                  <span className="text-[11px] font-medium text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/50 px-2 py-0.5 rounded-full border border-blue-200 dark:border-blue-900/40 flex items-center gap-1">
                    <Users className="h-3 w-3" />
                    跨部門會議 ({selectedDepts.length})
                  </span>
                )}
              </div>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {departments.map(d => {
                  const active = selectedDepts.includes(d.key)
                  return (
                    <button
                      key={d.key}
                      type="button"
                      onClick={() => toggleDept(d.key)}
                      className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-left text-xs transition-all ${
                        active
                          ? 'border-primary bg-primary/10 font-semibold text-primary ring-1 ring-primary'
                          : 'border-border bg-background hover:bg-muted/50 text-muted-foreground'
                      }`}
                    >
                      <span className="text-sm">{d.icon}</span>
                      <span className="truncate flex-1">{d.label}</span>
                      {active && <CheckCircle2 className="h-3.5 w-3.5 text-primary shrink-0" />}
                    </button>
                  )
                })}
              </div>
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

          {err && (
            <div className="flex items-start gap-2 rounded-lg bg-red-50 p-3 text-xs text-red-700 dark:bg-red-950/40 dark:text-red-300 border border-red-200 dark:border-red-900/50">
              <AlertCircle className="h-4 w-4 shrink-0 text-red-600 mt-0.5" />
              <div className="space-y-0.5">
                <p className="font-semibold">建立會議失敗</p>
                <p className="break-all">{err}</p>
              </div>
            </div>
          )}

          <Button onClick={createMeeting} disabled={creating} className="w-full gap-1.5">
            {creating ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                建立中…
              </>
            ) : (
              <>
                <Plus className="h-4 w-4" />{t('create')}
              </>
            )}
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
              disabled={joining}
            />
            <Button variant="outline" onClick={() => joinMeeting()} disabled={!joinCode.trim() || joining} className="gap-1.5">
              {joining ? <Loader2 className="h-4 w-4 animate-spin" /> : t('join')}
            </Button>
          </div>
        </Card>

        {/* 我的會議紀錄 */}
        <Card className="space-y-2 p-4">
          <p className="flex items-center gap-1.5 text-sm font-medium"><History className="h-4 w-4" />{t('history')}</p>
          {history.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t('historyEmpty')}</p>
          ) : (
            <div className="divide-y">
              {history.map(m => (
                <div key={m.id} className="flex items-center gap-2">
                  <button
                    onClick={() => openMeeting(m)}
                    className="flex min-w-0 flex-1 items-center justify-between gap-3 py-2 text-left text-sm hover:text-primary"
                  >
                    <span className="min-w-0 truncate">
                      {m.title || t('title')}
                      {m.role === 'viewer' && <span className="ml-1.5 rounded bg-amber-50 px-1.5 py-0.5 text-[10px] text-amber-700 dark:bg-amber-950/50">{tr('viewOnlyBadge', { host: m.host_name || '' })}</span>}
                    </span>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {m.created_at ? `${fmtDate(m.created_at)} ${fmtTime(m.created_at)}` : ''} · <span className="font-mono">{m.room_code}</span>
                    </span>
                  </button>
                  {m.role !== 'viewer' && <button
                    onClick={() => deleteMeeting(m)}
                    title={m.host_id === me?.id ? t('delete') : t('removeFromList')}
                    className="shrink-0 rounded p-1.5 text-muted-foreground hover:bg-red-50 hover:text-red-500"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>}
                </div>
              ))}
            </div>
          )}
        </Card>

        <MeetingViewerGrants />
      </div>
    )
  }

  // ── 會議進行中畫面 ──
  const isHost = me?.id === meeting.host_id
  const viewOnly = meeting.role === 'viewer'
  const meetingDeptKeys = meeting.departments?.length
    ? meeting.departments
    : (meeting.department ? meeting.department.split(',') : [])
  const matchedDepts = departments.filter(d => meetingDeptKeys.includes(d.key))

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

            {/* 會議語言徽章：主要語言在前 */}
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] bg-muted border text-muted-foreground font-medium">
              <Languages className="h-3 w-3" />
              {meetingLangs(meeting).map((c, i) => {
                const label = TARGET_LANGS.find(l => l.code === c)?.label ?? c
                return i === 0 ? <b key={c} className="text-foreground">{label}</b> : <span key={c}>· {label}</span>
              })}
            </span>

            {/* 部門徽章（支援跨部門多個徽章） */}
            {matchedDepts.map(d => (
              <span key={d.key} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] bg-muted border text-muted-foreground font-medium">
                <span>{d.icon}</span>
                <span>{d.label}</span>
              </span>
            ))}
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

      {/* 實體會議狀態與現場控制列 */}
      {meeting.meeting_mode === 'in_person' && (
        <div className="rounded-lg bg-amber-50/60 border border-amber-200/60 p-2 text-xs text-amber-900 dark:bg-amber-950/30 dark:text-amber-300 dark:border-amber-900/40 flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-1.5">
            <Radio className="h-3.5 w-3.5 shrink-0 text-amber-600" />
            <span>{!isHost ? t('inPersonNotice') : '現場收音中：一人開麥即可辨識全場發言'}</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 bg-background/90 px-2 py-0.5 rounded border text-xs">
              <Users className="h-3 w-3 text-amber-600 dark:text-amber-400" />
              <span className="text-muted-foreground">現場人數：</span>
              <select
                value={expectedSpeakers}
                onChange={e => handleSpeakerCountChange(Number(e.target.value))}
                className="bg-transparent font-semibold text-foreground focus:outline-none cursor-pointer"
                title="調整現場發言人數上限（約束聲紋分離分群）"
              >
                {[2, 3, 4, 5, 6, 7, 8, 9, 10, 12, 15, 20, 25, 30, 36].map(n => (
                  <option key={n} value={n}>{n} 人</option>
                ))}
              </select>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setSpeakerModalActiveTab(null)
                setSpeakerModalOpen(true)
              }}
              className="h-6 px-2 text-xs gap-1 bg-background"
              title="管理與合併講者姓名"
            >
              <UserCheck className="h-3 w-3 text-amber-600 dark:text-amber-400" />
              講者管理 / 合併
            </Button>
          </div>
        </div>
      )}

      {viewOnly && (
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:bg-amber-950/50 dark:text-amber-300">
          {tr('viewOnlyNotice', { host: meeting.host_name || '' })}
        </p>
      )}

      {/* 控制列：麥克風、輸入辨識語言、翻譯目標語言、視訊、三段式檢視切換 */}
      <div className="flex items-center gap-2 border-y py-2 flex-wrap">
        {viewOnly ? null : srSupported ? (
          recording ? (
            <Button size="sm" variant="destructive" onClick={stopRec} className="gap-1.5 shrink-0">
              <MicOff className="h-4 w-4" />{t('stop')}
            </Button>
          ) : (
            <Button size="sm" onClick={startRec} className="gap-1.5 shrink-0">
              <Mic className="h-4 w-4" />{t('start')}
            </Button>
          )
        ) : (
          <span className="text-xs text-muted-foreground">{t('unsupported')}</span>
        )}

        <LangPicker
          value={inputLang}
          onChange={setInputLang}
          label={t('inputLangLabel')}
          options={INPUT_LANGS}
          disabled={recording}
          compact
        />

        <LangPicker
          value={targetLang}
          onChange={setTargetLang}
          label={t('targetLangLabel')}
          options={TRANSLATION_TARGET_OPTIONS}
          compact
          icon={<Languages className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />}
        />

        {recording && (
          <span className="flex items-center gap-1.5 text-xs text-red-500">
            <span className="h-2 w-2 animate-pulse rounded-full bg-red-500" />
            {speechEngine === 'azure' ? (
              <span className="font-medium text-blue-600 dark:text-blue-400 flex items-center gap-1">
                <Sparkles className="h-3 w-3" />
                {meeting.meeting_mode === 'in_person' ? 'Azure 聲紋分離中' : 'Azure AI 語音'}
              </span>
            ) : (
              t('listening')
            )}
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

        <Button size="sm" variant="outline" onClick={downloadRecord} disabled={downloading || lines.length === 0} className="gap-1.5">
          <Download className="h-4 w-4" />{downloading ? t('downloading') : t('download')}
        </Button>

        {/* 視訊、聊天、邀請訪客（只能瀏覽者只看聊天） */}
        {viewOnly ? null : video ? (
          <Button size="sm" variant="outline" onClick={stopVideo} className="gap-1.5">
            <VideoOff className="h-4 w-4" />{t('videoStop')}
          </Button>
        ) : (
          <Button size="sm" variant="outline" onClick={() => setVideo(true)} className="gap-1.5">
            <Video className="h-4 w-4" />{t('videoStart')}
          </Button>
        )}
        <Button size="sm" variant={showChat ? 'default' : 'outline'} onClick={() => setShowChat(v => !v)} className="gap-1.5">
          <MessageSquare className="h-4 w-4" />{tr('chatTitle')}
        </Button>
        {me?.id === meeting.host_id && (
          <Button size="sm" variant="outline" onClick={() => setInviteOpen(true)} className="gap-1.5">
            <UserPlus className="h-4 w-4" />{tr('inviteGuest')}
          </Button>
        )}
      </div>

      {micDenied && <p className="text-sm text-red-500">{t('micDenied')}</p>}

      {(video || showChat) && me && (
        <div className={`grid gap-3 ${video && showChat ? 'lg:grid-cols-[1fr_340px]' : ''}`}>
          {video && <MeetingVideo meetingId={meeting.id} selfId={`u-${me.id}`} selfName={me.name} onClose={stopVideo} />}
          {showChat && <MeetingChat meetingId={meeting.id} readOnly={viewOnly} />}
        </div>
      )}
      {inviteOpen && <GuestInviteDialog meetingId={meeting.id} roomCode={meeting.room_code} onClose={() => setInviteOpen(false)} />}

      {/* 逐字稿與翻譯輸出區 */}
      <div className="flex-1 space-y-3 overflow-y-auto rounded-lg border p-3">
        {lines.length === 0 && !interim ? (
          <p className="py-8 text-center text-sm text-muted-foreground">{t('empty')}</p>
        ) : (
          lines.map(l => {
            const tr = translatedOf(l)
            const mine = l.speaker_id === me?.id
            const isRemoteAttendee = meeting.meeting_mode === 'in_person' && l.speaker_id !== meeting.host_id

            // 實體現場會議由同一台麥克風收錄全場，或是具有 Azure 講者分離標籤時，一律顯示講者標籤（如「講者 1」、「講者 2」）
            // 只有線上會議且未分離出講者、且為自己發言時，才顯示「你」
            const isDiarized = l.speaker_name && (
              l.speaker_name.startsWith('講者') ||
              l.speaker_name.startsWith('Speaker') ||
              l.speaker_name.startsWith('Guest')
            )
            const rawSpeaker = l.speaker_name || (meeting.meeting_mode === 'in_person' ? '講者 1' : '')
            const resolvedName = resolveSpeakerDisplayName(rawSpeaker, speakerAliases)
            const displayName = isRemoteAttendee
              ? `${l.speaker_name || '遠端成員'}`
              : (isDiarized || meeting.meeting_mode === 'in_person'
                ? (resolvedName || rawSpeaker || '講者 1')
                : (mine ? t('you') : (resolvedName || l.speaker_name || '—')))

            const badgeClass = getSpeakerBadgeClass(rawSpeaker, mine, meeting.meeting_mode)
            const canManage = !isRemoteAttendee && (isDiarized || meeting.meeting_mode === 'in_person')

            return (
              <div key={l.id} className="text-sm border-b pb-2 last:border-b-0">
                <div className="flex items-baseline gap-2">
                  {isRemoteAttendee ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-200 border border-emerald-300 dark:border-emerald-800 shadow-sm">
                      <Globe className="h-3 w-3" />
                      {displayName}
                      <span className="text-[10px] font-normal opacity-80">(遠端)</span>
                    </span>
                  ) : (
                    <span
                      onClick={() => {
                        if (canManage) {
                          setSpeakerModalActiveTab(rawSpeaker)
                          setSpeakerModalOpen(true)
                        }
                      }}
                      title={canManage ? `點擊可管理「${rawSpeaker}」姓名或合併講者` : undefined}
                      className={badgeClass}
                    >
                      {displayName}
                    </span>
                  )}
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
        {/* 辨識中（尚未定稿）的即時文字 */}
        {interim && (
          <div className="text-sm text-muted-foreground italic flex items-baseline gap-2">
            {interim.speaker && (
              <span className={getSpeakerBadgeClass(interim.speaker, true, meeting.meeting_mode)}>
                {resolveSpeakerDisplayName(interim.speaker, speakerAliases) || interim.speaker}
              </span>
            )}
            <span>{interim.text}…</span>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* 現場講者管理與合併彈窗 */}
      {speakerModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <Card className="w-full max-w-lg p-5 space-y-4 shadow-xl border bg-background max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between border-b pb-3 shrink-0">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                  <UserCheck className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="font-bold text-base">現場講者管理與合併</h3>
                  <p className="text-xs text-muted-foreground">自訂講者真實姓名，或將誤判的講者合併為同一人</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSpeakerModalOpen(false)}
                className="rounded-md p-1 hover:bg-muted text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-3 overflow-y-auto pr-1 flex-1">
              {/* 現場人數快速調節 */}
              <div className="flex items-center justify-between p-2.5 rounded-lg border bg-muted/20 text-xs">
                <div className="flex items-center gap-1.5">
                  <Users className="h-4 w-4 text-primary" />
                  <span className="font-medium">現場發言人數上限：</span>
                </div>
                <div className="flex flex-wrap items-center gap-1">
                  {[2, 3, 4, 5, 6, 8, 10, 12].map(num => (
                    <button
                      key={num}
                      type="button"
                      onClick={() => handleSpeakerCountChange(num)}
                      className={`px-2 py-0.5 rounded text-xs transition-all ${
                        expectedSpeakers === num
                          ? 'bg-primary text-primary-foreground font-semibold'
                          : 'bg-background border hover:bg-muted'
                      }`}
                    >
                      {num} 人
                    </button>
                  ))}
                  <div className="flex items-center gap-1 text-xs pl-1">
                    <span>自訂：</span>
                    <input
                      type="number"
                      min={1}
                      max={36}
                      value={expectedSpeakers}
                      onChange={e => handleSpeakerCountChange(parseInt(e.target.value, 10) || 1)}
                      className="w-12 h-6 text-center rounded border bg-background text-xs font-bold text-foreground focus:outline-none"
                    />
                    <span>人</span>
                  </div>
                </div>
              </div>

              {/* 講者清單 */}
              <div className="space-y-2.5">
                {modalSpeakerList.map(sp => {
                  const raw = sp.id
                  const isMerged = !!speakerAliases[raw] && modalSpeakerList.some(other => other.id === speakerAliases[raw])
                  const targetMergedId = isMerged ? speakerAliases[raw] : null
                  const currentCustomName = !isMerged ? (speakerAliases[raw] || '') : ''
                  const count = speakerCountMap[raw] || 0

                  return (
                    <div
                      key={raw}
                      className={`p-3 rounded-lg border text-xs space-y-2 transition-all ${
                        speakerModalActiveTab === raw ? 'ring-2 ring-primary border-primary' : 'bg-card'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className={getSpeakerBadgeClass(raw, false, 'in_person')}>
                            {raw}
                          </span>
                          <span className="text-[11px] text-muted-foreground">
                            （{count} 則發言）
                          </span>
                        </div>
                        {isMerged && (
                          <span className="text-[11px] font-medium text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 px-2 py-0.5 rounded border border-amber-200 dark:border-amber-900/50">
                            已合併至 {targetMergedId}
                          </span>
                        )}
                      </div>

                      {isMerged ? (
                        <div className="flex items-center justify-between bg-muted/40 p-2 rounded">
                          <span className="text-muted-foreground">
                            此講者的所有發言已合併顯示為「{resolveSpeakerDisplayName(targetMergedId!, speakerAliases)}」
                          </span>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleUnmergeSpeaker(raw)}
                            className="h-6 px-2 text-xs text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/40"
                          >
                            取消合併
                          </Button>
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                          <div className="space-y-1">
                            <label className="text-[11px] text-muted-foreground">姓名設定：</label>
                            <Input
                              value={currentCustomName}
                              onChange={e => handleSetSpeakerAlias(raw, e.target.value)}
                              placeholder="自訂姓名（例：王廠長）"
                              className="h-7 text-xs"
                            />
                          </div>

                          <div className="space-y-1">
                            <label className="text-[11px] text-muted-foreground">合併發言至其他講者：</label>
                            <select
                              value=""
                              onChange={e => {
                                if (e.target.value) handleMergeSpeaker(raw, e.target.value)
                              }}
                              className="w-full h-7 rounded-md border bg-background px-2 text-xs focus:outline-none"
                            >
                              <option value="">選擇要合併的目標講者…</option>
                              {modalSpeakerList
                                .filter(other => other.id !== raw && speakerAliases[other.id] !== raw)
                                .map(other => (
                                  <option key={other.id} value={other.id}>
                                    合併至 {resolveSpeakerDisplayName(other.id, speakerAliases) || other.id}
                                  </option>
                                ))}
                            </select>
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>

            <div className="pt-2 border-t flex justify-end shrink-0">
              <Button onClick={() => setSpeakerModalOpen(false)} className="px-5 text-xs h-8">
                完成
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  )
}

// ── 語言選擇器 ────────────────────────────────────────────────────
function LangPicker({
  value, onChange, label, disabled, compact, options = TARGET_LANGS, icon,
}: {
  value: string
  onChange: (v: string) => void
  label: string
  disabled?: boolean
  compact?: boolean
  options?: { code: string; label: string }[]
  icon?: React.ReactNode
}) {
  return (
    <label className={`flex items-center gap-1.5 ${compact ? 'text-xs' : 'text-sm'}`}>
      {icon}
      <span className="text-muted-foreground whitespace-nowrap">{label}</span>
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        disabled={disabled}
        className="rounded-md border bg-background px-2 py-1 text-xs font-medium text-foreground disabled:opacity-50"
      >
        {options.map(l => <option key={l.code} value={l.code}>{l.label}</option>)}
      </select>
    </label>
  )
}

function getSpeakerBadgeClass(rawSpeaker: string | undefined, isMine: boolean, mode?: string) {
  const name = rawSpeaker || ''
  const isDiarized = name.startsWith('講者') || name.startsWith('Speaker') || name.startsWith('Guest')

  if (isDiarized || mode === 'in_person') {
    const numMatch = name.match(/\d+/)
    const num = numMatch ? parseInt(numMatch[0], 10) : 1
    const palettes = [
      'bg-blue-100 text-blue-800 dark:bg-blue-950/80 dark:text-blue-200 border border-blue-300 dark:border-blue-800',
      'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-200 border border-emerald-300 dark:border-emerald-800',
      'bg-purple-100 text-purple-800 dark:bg-purple-950/80 dark:text-purple-200 border border-purple-300 dark:border-purple-800',
      'bg-amber-100 text-amber-800 dark:bg-amber-950/80 dark:text-amber-200 border border-amber-300 dark:border-amber-800',
      'bg-rose-100 text-rose-800 dark:bg-rose-950/80 dark:text-rose-200 border border-rose-300 dark:border-rose-800',
      'bg-cyan-100 text-cyan-800 dark:bg-cyan-950/80 dark:text-cyan-200 border border-cyan-300 dark:border-cyan-800',
    ]
    const chosen = palettes[(num - 1) % palettes.length]
    return `${chosen} px-2 py-0.5 rounded-md text-xs font-semibold cursor-pointer hover:opacity-80 transition-opacity select-none shadow-sm`
  }

  if (isMine) {
    return 'text-blue-600 dark:text-blue-400 font-semibold'
  }

  return 'text-foreground font-semibold'
}
