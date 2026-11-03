'use client'

/**
 * 本機錄影：用瀏覽器「分享畫面」錄下目前分頁（含視訊畫面與對方聲音），
 * 再混入自己的麥克風，結束後直接下載到本機，不上傳。
 * 手機瀏覽器不支援分享畫面，不顯示此功能。
 */
import { useEffect, useRef, useState } from 'react'
import { Circle, Square } from 'lucide-react'
import { Button } from '@/components/ui/button'

function canScreenRecord(): boolean {
  if (typeof window === 'undefined' || typeof MediaRecorder === 'undefined') return false
  const md = navigator.mediaDevices as MediaDevices | undefined
  if (!md || typeof md.getDisplayMedia !== 'function') return false
  // Android Chrome/Firefox 有此函式但一律拒絕，排除行動裝置
  return !/Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent)
}

function pickMime(): string {
  const list = ['video/mp4;codecs=avc1,mp4a.40.2', 'video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm']
  return list.find(m => MediaRecorder.isTypeSupported(m)) ?? ''
}

function fmt(sec: number): string {
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60
  return `${h ? `${h}:` : ''}${String(m).padStart(h ? 2 : 1, '0')}:${String(s).padStart(2, '0')}`
}

export function LocalRecorder({ fileName }: { fileName: string }) {
  const [supported, setSupported] = useState(false)
  const [rec, setRec] = useState(false)
  const [sec, setSec] = useState(0)
  const [err, setErr] = useState('')
  const recorderRef = useRef<MediaRecorder | null>(null)
  const cleanupRef = useRef<(() => void) | null>(null)

  useEffect(() => { setSupported(canScreenRecord()) }, [])
  useEffect(() => {
    if (!rec) return
    const id = setInterval(() => setSec(s => s + 1), 1000)
    return () => clearInterval(id)
  }, [rec])
  useEffect(() => () => { try { recorderRef.current?.stop() } catch {} }, [])

  const stop = () => { try { recorderRef.current?.stop() } catch {} }

  const start = async () => {
    setErr('')
    let display: MediaStream
    try {
      display = await navigator.mediaDevices.getDisplayMedia({
        video: { frameRate: 24 }, audio: true,
        // Chrome：預設選目前分頁、可勾選分享分頁音訊
        preferCurrentTab: true, selfBrowserSurface: 'include', systemAudio: 'include',
      } as DisplayMediaStreamOptions)
    } catch { return } // 使用者取消

    let mic: MediaStream | null = null
    try { mic = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } }) } catch {}

    // 混音：分頁聲音（對方）＋自己的麥克風
    const ctx = new AudioContext()
    const dest = ctx.createMediaStreamDestination()
    if (display.getAudioTracks().length) ctx.createMediaStreamSource(new MediaStream(display.getAudioTracks())).connect(dest)
    if (mic) ctx.createMediaStreamSource(mic).connect(dest)
    if (!display.getAudioTracks().length) setErr('未分享分頁音訊，錄影只會有你自己的聲音（下次請勾選「分享分頁音訊」）')

    const stream = new MediaStream([...display.getVideoTracks(), ...dest.stream.getAudioTracks()])
    const mime = pickMime()
    const mr = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined)
    const chunks: Blob[] = []
    mr.ondataavailable = e => { if (e.data.size) chunks.push(e.data) }
    mr.onstop = () => {
      cleanupRef.current?.()
      const type = mr.mimeType || mime || 'video/webm'
      const blob = new Blob(chunks, { type })
      if (blob.size) {
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        const d = new Date()
        const stamp = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}_${String(d.getHours()).padStart(2, '0')}${String(d.getMinutes()).padStart(2, '0')}`
        a.href = url
        a.download = `${fileName.replace(/[\\/:*?"<>|]/g, '_')}_${stamp}.${type.includes('mp4') ? 'mp4' : 'webm'}`
        a.click()
        setTimeout(() => URL.revokeObjectURL(url), 10000)
      }
      recorderRef.current = null
      setRec(false)
    }
    cleanupRef.current = () => {
      display.getTracks().forEach(t => t.stop())
      mic?.getTracks().forEach(t => t.stop())
      void ctx.close().catch(() => {})
      cleanupRef.current = null
    }
    // 使用者從瀏覽器列按「停止分享」時一併結束錄影
    display.getVideoTracks()[0]?.addEventListener('ended', stop)

    recorderRef.current = mr
    mr.start(1000)
    setSec(0)
    setRec(true)
  }

  if (!supported) return null
  return (
    <>
      {rec ? (
        <Button size="sm" variant="destructive" onClick={stop} className="gap-1.5 shrink-0">
          <Square className="h-3.5 w-3.5" />停止錄影 {fmt(sec)}
        </Button>
      ) : (
        <Button size="sm" variant="outline" onClick={start} className="gap-1.5 shrink-0" title="錄下此分頁畫面與聲音，存到本機">
          <Circle className="h-3.5 w-3.5 fill-red-500 text-red-500" />本機錄影
        </Button>
      )}
      {err && <span className="w-full text-xs text-amber-600">{err}</span>}
    </>
  )
}
