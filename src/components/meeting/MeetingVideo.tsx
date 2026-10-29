'use client'

/**
 * 會議視訊：有設定 JaaS（8x8 Jitsi）就用 JaaS；未設定（API 回 501）改用內建 WebRTC 點對點。
 * 內建模式以 Supabase Realtime（broadcast＋presence）交換信令，不需安裝套件；
 * 每人與其他人各建一條連線（mesh），適合 2–4 人的面試／小會議。
 */
import { useEffect, useRef, useState, useCallback } from 'react'
import { useTranslations } from 'next-intl'
import { Mic, MicOff, Video, VideoOff, Loader2, PhoneOff, RefreshCw } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'

interface JaasApi {
  dispose(): void
  addListener(event: string, fn: (e: Record<string, unknown>) => void): void
  isAudioAvailable(): Promise<boolean>
  isAudioMuted(): Promise<boolean>
  executeCommand(cmd: string, ...args: unknown[]): void
}

function isMobileDevice(): boolean {
  if (typeof navigator === 'undefined') return false
  const uaData = (navigator as unknown as { userAgentData?: { mobile?: boolean } }).userAgentData
  if (uaData?.mobile) return true
  return /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent) || (navigator.maxTouchPoints > 1 && /Macintosh/.test(navigator.userAgent))
}

/** 先在本頁請求鏡頭＋麥克風權限（手機 Chrome 常因 iframe 內才詢問而被擋，導致 Jitsi 麥克風灰掉） */
async function preflightMedia(): Promise<'ok' | 'mic-denied' | 'all-denied'> {
  if (!navigator.mediaDevices?.getUserMedia) return 'ok'
  try {
    const s = await navigator.mediaDevices.getUserMedia({ audio: true, video: true })
    s.getTracks().forEach(t => t.stop())
    return 'ok'
  } catch {
    try {
      const a = await navigator.mediaDevices.getUserMedia({ audio: true })
      a.getTracks().forEach(t => t.stop())
      return 'ok'
    } catch {
      try {
        const v = await navigator.mediaDevices.getUserMedia({ video: true })
        v.getTracks().forEach(t => t.stop())
        return 'mic-denied'
      } catch { return 'all-denied' }
    }
  }
}
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

const ICE: RTCConfiguration = {
  iceServers: [{ urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302', 'stun:stun.cloudflare.com:3478'] }],
}

export function MeetingVideo({ meetingId, selfId, selfName, authHeaders, onClose }: {
  meetingId: string; selfId: string; selfName: string
  authHeaders?: Record<string, string>
  onClose: () => void
}) {
  const t = useTranslations('MeetingRoom')
  const [mode, setMode] = useState<'loading' | 'jaas' | 'webrtc' | 'error'>('loading')
  const [jaas, setJaas] = useState<{ jwt: string; room: string; appId: string } | null>(null)
  const boxRef = useRef<HTMLDivElement | null>(null)
  const apiRef = useRef<JaasApi | null>(null)
  const [micProblem, setMicProblem] = useState(false)
  const [jaasAvailable, setJaasAvailable] = useState(false)
  const [reload, setReload] = useState(0)
  const headersKey = JSON.stringify(authHeaders ?? {})

  // 備案：任一人切換視訊模式時，用 broadcast 通知同場所有人一起切換（並存到會議，晚加入者也跟著）
  const chRef = useRef<ReturnType<ReturnType<typeof createClient>['channel']> | null>(null)
  useEffect(() => {
    const supabase = createClient()
    const ch = supabase.channel(`meetvid:${meetingId}`, { config: { broadcast: { self: false } } })
      .on('broadcast', { event: 'mode' }, () => setReload(n => n + 1))
      .subscribe()
    chRef.current = ch
    return () => { chRef.current = null; void supabase.removeChannel(ch) }
  }, [meetingId])

  const switchMode = async (next: 'auto' | 'webrtc') => {
    setMode('loading')
    await fetch('/api/meeting/video-mode', {
      method: 'POST', headers: { 'Content-Type': 'application/json', ...JSON.parse(headersKey) },
      body: JSON.stringify({ meetingId, mode: next }),
    }).catch(() => {})
    void chRef.current?.send({ type: 'broadcast', event: 'mode', payload: { mode: next } })
    setReload(n => n + 1)
  }

  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        const res = await fetch('/api/meeting/jaas-token', {
          method: 'POST', headers: { 'Content-Type': 'application/json', ...JSON.parse(headersKey) },
          body: JSON.stringify({ meetingId }),
        })
        if (!alive) return
        if (res.status === 501) {
          const e = await res.json().catch(() => ({})) as { jaasAvailable?: boolean }
          setJaasAvailable(!!e.jaasAvailable); setMode('webrtc'); return
        }
        if (!res.ok) { setMode('error'); return }
        const j = await res.json() as { jwt: string; room: string; appId: string }
        // Jitsi 手機網頁版加入時常拿不到麥克風（出現 Join without audio）：
        // 有人用手機開視訊時，整場改用內建視訊（存到會議並通知其他人一起切）
        if (isMobileDevice()) {
          await fetch('/api/meeting/video-mode', {
            method: 'POST', headers: { 'Content-Type': 'application/json', ...JSON.parse(headersKey) },
            body: JSON.stringify({ meetingId, mode: 'webrtc' }),
          }).catch(() => {})
          void chRef.current?.send({ type: 'broadcast', event: 'mode', payload: { mode: 'webrtc' } })
          if (!alive) return
          setJaasAvailable(true); setMode('webrtc'); return
        }
        const perm = await preflightMedia()
        if (!alive) return
        setMicProblem(perm !== 'ok')
        await loadJaasScript(j.appId)
        if (!alive) return
        setJaas(j); setJaasAvailable(true); setMode('jaas')
      } catch { if (alive) setMode('webrtc') }
    })()
    return () => { alive = false }
  }, [meetingId, headersKey, reload])

  useEffect(() => {
    if (mode !== 'jaas' || !jaas || !boxRef.current) return
    const w = window as unknown as { JitsiMeetExternalAPI?: JaasCtor }
    if (!w.JitsiMeetExternalAPI) return
    const api = new w.JitsiMeetExternalAPI('8x8.vc', {
      roomName: `${jaas.appId}/${jaas.room}`, jwt: jaas.jwt, parentNode: boxRef.current,
      configOverwrite: { prejoinPageEnabled: false, prejoinConfig: { enabled: false }, startWithAudioMuted: false, startWithVideoMuted: false, disableDeepLinking: true },
      userInfo: { displayName: selfName },
    }) as JaasApi
    apiRef.current = api
    // 麥克風拿不到時（權限被擋、被其他程式占用）提示使用者
    const check = () => { api.isAudioAvailable().then(ok => setMicProblem(!ok)).catch(() => {}) }
    api.addListener('audioAvailabilityChanged', e => setMicProblem(!e.available))
    api.addListener('videoConferenceJoined', () => {
      check()
      api.isAudioMuted().then(m => { if (m) api.executeCommand('toggleAudio') }).catch(() => {})
    })
    return () => { apiRef.current = null; try { api.dispose() } catch {} }
  }, [mode, jaas, selfName])

  if (mode === 'loading') return <div className="h-72 rounded-lg border bg-black/90 flex items-center justify-center text-gray-300"><Loader2 className="h-6 w-6 animate-spin" /></div>
  if (mode === 'error') return <div className="rounded-lg border p-4 text-sm text-red-600">{t('videoFailed')}</div>
  const retryMic = async () => {
    const perm = await preflightMedia()
    setMicProblem(perm !== 'ok')
    if (perm === 'ok') {
      // 重新掛載 Jitsi，讓它重新取得麥克風
      setJaas(j => (j ? { ...j } : j))
    }
  }

  if (mode === 'jaas') return (
    <div className="space-y-2">
      {micProblem && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900 dark:bg-amber-950/50 dark:text-amber-200 space-y-1.5">
          <p className="font-medium">{t('micBlockedTitle')}</p>
          <p className="whitespace-pre-line">{t('micBlockedHelp')}</p>
          <Button size="sm" variant="outline" onClick={retryMic} className="h-7 gap-1.5"><Mic className="h-3.5 w-3.5" />{t('micRetry')}</Button>
        </div>
      )}
      <div ref={boxRef} className="h-[420px] w-full overflow-hidden rounded-lg border bg-black" />
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" variant="outline" onClick={onClose} className="gap-1.5"><PhoneOff className="h-4 w-4" />{t('videoLeave')}</Button>
        <Button size="sm" variant="outline" onClick={() => switchMode('webrtc')} className="gap-1.5"><RefreshCw className="h-4 w-4" />{t('switchToBuiltin')}</Button>
        <span className="text-[11px] text-gray-500">{t('switchToBuiltinHint')}</span>
      </div>
    </div>
  )
  return (
    <div className="space-y-2">
      <WebRtcRoom key={reload} meetingId={meetingId} selfId={selfId} selfName={selfName} onClose={onClose} />
      {jaasAvailable && (
        <Button size="sm" variant="ghost" onClick={() => switchMode('auto')} className="gap-1.5 text-xs h-7"><RefreshCw className="h-3.5 w-3.5" />{t('switchToJaas')}</Button>
      )}
    </div>
  )
}

interface Peer { id: string; name: string; stream: MediaStream | null; state: string }
type Signal = { from: string; to: string; kind: 'offer' | 'answer' | 'ice'; sdp?: RTCSessionDescriptionInit; cand?: RTCIceCandidateInit }

function WebRtcRoom({ meetingId, selfId, selfName, onClose }: { meetingId: string; selfId: string; selfName: string; onClose: () => void }) {
  const t = useTranslations('MeetingRoom')
  const [local, setLocal] = useState<MediaStream | null>(null)
  const [peers, setPeers] = useState<Record<string, Peer>>({})
  const [micOn, setMicOn] = useState(true)
  const [camOn, setCamOn] = useState(true)
  const [err, setErr] = useState('')
  const pcs = useRef(new Map<string, RTCPeerConnection>())
  const pendingIce = useRef(new Map<string, RTCIceCandidateInit[]>())

  const setPeer = useCallback((id: string, patch: Partial<Peer>) => {
    setPeers(prev => ({ ...prev, [id]: { id, name: prev[id]?.name ?? '', stream: prev[id]?.stream ?? null, state: prev[id]?.state ?? 'new', ...patch } }))
  }, [])

  useEffect(() => {
    let alive = true
    let stream: MediaStream | null = null
    const supabase = createClient()
    const ch = supabase.channel(`meetrtc:${meetingId}`, { config: { broadcast: { self: false }, presence: { key: selfId } } })
    const send = (s: Omit<Signal, 'from'>) => ch.send({ type: 'broadcast', event: 'signal', payload: { ...s, from: selfId } })

    const getPc = (peerId: string) => {
      let pc = pcs.current.get(peerId)
      if (pc) return pc
      pc = new RTCPeerConnection(ICE)
      stream?.getTracks().forEach(tr => pc!.addTrack(tr, stream!))
      pc.onicecandidate = e => { if (e.candidate) void send({ to: peerId, kind: 'ice', cand: e.candidate.toJSON() }) }
      pc.ontrack = e => setPeer(peerId, { stream: e.streams[0] ?? new MediaStream([e.track]) })
      pc.onconnectionstatechange = () => setPeer(peerId, { state: pc!.connectionState })
      pcs.current.set(peerId, pc)
      return pc
    }
    const flushIce = async (peerId: string, pc: RTCPeerConnection) => {
      for (const c of pendingIce.current.get(peerId) ?? []) await pc.addIceCandidate(c).catch(() => {})
      pendingIce.current.delete(peerId)
    }
    const closePeer = (peerId: string) => {
      pcs.current.get(peerId)?.close(); pcs.current.delete(peerId)
      setPeers(prev => { const n = { ...prev }; delete n[peerId]; return n })
    }
    const call = async (peerId: string) => {
      const pc = getPc(peerId)
      const offer = await pc.createOffer()
      await pc.setLocalDescription(offer)
      void send({ to: peerId, kind: 'offer', sdp: offer })
    }

    ;(async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { width: { ideal: 640 }, height: { ideal: 480 } }, audio: true })
      } catch {
        try { stream = await navigator.mediaDevices.getUserMedia({ audio: true }) } catch { setErr(t('mediaDenied')) }
      }
      if (!alive) { stream?.getTracks().forEach(tr => tr.stop()); return }
      setLocal(stream)

      ch.on('broadcast', { event: 'signal' }, async ({ payload }) => {
        const s = payload as Signal
        if (s.to !== selfId) return
        if (s.kind === 'offer' && s.sdp) {
          const pc = getPc(s.from)
          await pc.setRemoteDescription(s.sdp)
          await flushIce(s.from, pc)
          const answer = await pc.createAnswer()
          await pc.setLocalDescription(answer)
          void send({ to: s.from, kind: 'answer', sdp: answer })
        } else if (s.kind === 'answer' && s.sdp) {
          const pc = pcs.current.get(s.from)
          if (pc && pc.signalingState === 'have-local-offer') { await pc.setRemoteDescription(s.sdp); await flushIce(s.from, pc) }
        } else if (s.kind === 'ice' && s.cand) {
          const pc = pcs.current.get(s.from)
          if (pc?.remoteDescription) await pc.addIceCandidate(s.cand).catch(() => {})
          else pendingIce.current.set(s.from, [...(pendingIce.current.get(s.from) ?? []), s.cand])
        }
      })
      ch.on('presence', { event: 'sync' }, () => {
        const state = ch.presenceState() as Record<string, { name?: string }[]>
        const ids = Object.keys(state).filter(k => k !== selfId)
        for (const id of ids) {
          setPeer(id, { name: state[id]?.[0]?.name ?? '' })
          // 只由 id 較小的一方發起，避免雙方同時 offer
          if (!pcs.current.has(id) && selfId < id) void call(id)
        }
        for (const id of Array.from(pcs.current.keys())) if (!ids.includes(id)) closePeer(id)
      })
      ch.subscribe(status => { if (status === 'SUBSCRIBED') void ch.track({ name: selfName }) })
    })()

    const pcMap = pcs.current
    return () => {
      alive = false
      for (const pc of pcMap.values()) pc.close()
      pcMap.clear()
      stream?.getTracks().forEach(tr => tr.stop())
      void supabase.removeChannel(ch)
    }
  }, [meetingId, selfId, selfName, setPeer, t])

  const toggle = (kind: 'audio' | 'video') => {
    const tracks = kind === 'audio' ? local?.getAudioTracks() : local?.getVideoTracks()
    const next = kind === 'audio' ? !micOn : !camOn
    tracks?.forEach(tr => { tr.enabled = next })
    if (kind === 'audio') setMicOn(next); else setCamOn(next)
  }

  const list = Object.values(peers)
  return (
    <div className="space-y-2">
      <div className={`grid gap-2 ${list.length === 0 ? 'grid-cols-1' : list.length === 1 ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-2'}`}>
        <Tile stream={local} name={`${selfName}（${t('you')}）`} muted mirror />
        {list.map(p => <Tile key={p.id} stream={p.stream} name={p.name} state={p.state} />)}
      </div>
      {list.length === 0 && <p className="text-xs text-gray-500">{t('waitingOthers')}</p>}
      {err && <p className="text-xs text-red-600">{err}</p>}
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant={micOn ? 'outline' : 'destructive'} onClick={() => toggle('audio')} className="gap-1.5">
          {micOn ? <Mic className="h-4 w-4" /> : <MicOff className="h-4 w-4" />}{micOn ? t('micOn') : t('micOff')}
        </Button>
        <Button size="sm" variant={camOn ? 'outline' : 'destructive'} onClick={() => toggle('video')} className="gap-1.5">
          {camOn ? <Video className="h-4 w-4" /> : <VideoOff className="h-4 w-4" />}{camOn ? t('camOn') : t('camOff')}
        </Button>
        <Button size="sm" variant="outline" onClick={onClose} className="gap-1.5"><PhoneOff className="h-4 w-4" />{t('videoLeave')}</Button>
      </div>
    </div>
  )
}

function Tile({ stream, name, muted, mirror, state }: { stream: MediaStream | null; name: string; muted?: boolean; mirror?: boolean; state?: string }) {
  const t = useTranslations('MeetingRoom')
  const ref = useRef<HTMLVideoElement | null>(null)
  const [blocked, setBlocked] = useState(false)
  useEffect(() => {
    const v = ref.current
    if (!v) return
    if (v.srcObject !== stream) v.srcObject = stream
    if (!stream || muted) return
    // 手機瀏覽器常擋「有聲自動播放」：先試播，被擋就顯示「點此開啟聲音」
    v.muted = false
    v.play().then(() => setBlocked(false)).catch(() => {
      setBlocked(true)
      v.muted = true
      void v.play().catch(() => {})
    })
  }, [stream, muted])
  const unmute = () => {
    const v = ref.current
    if (!v) return
    v.muted = false
    v.play().then(() => setBlocked(false)).catch(() => setBlocked(true))
  }
  return (
    <div className="relative aspect-video rounded-lg overflow-hidden bg-gray-900">
      <video ref={ref} autoPlay playsInline muted={muted} className={`h-full w-full object-cover ${mirror ? '-scale-x-100' : ''}`} />
      {blocked && (
        <button onClick={unmute} className="absolute inset-0 flex items-center justify-center bg-black/50 text-white text-sm font-medium">
          🔊 {t('tapForSound')}
        </button>
      )}
      {!stream && <div className="absolute inset-0 flex items-center justify-center text-gray-400 text-xs"><Loader2 className="h-5 w-5 animate-spin" /></div>}
      <div className="absolute bottom-1 left-1 rounded bg-black/60 px-2 py-0.5 text-xs text-white">
        {name}{state === 'failed' ? ` · ${t('connFailed')}` : state && state !== 'connected' && state !== 'new' ? ` · ${state}` : ''}
      </div>
    </div>
  )
}
