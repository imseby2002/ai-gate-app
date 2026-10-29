'use client'

/**
 * 訪客語音記錄：把訪客（面試者）自己說的話轉成文字寫入會議逐字稿，主持人頁即時看得到。
 * 優先用 Azure 語音辨識（與視訊同時使用麥克風較穩），未設定時退回瀏覽器內建語音辨識。
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Mic, MicOff, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  fetchAzureSpeechToken, setAzureTokenHeaders, startAzureRecognition, type AzureRecognitionController,
} from '@/lib/meeting/azure-speech'

type SR = {
  lang: string; continuous: boolean; interimResults: boolean
  onresult: ((e: { resultIndex: number; results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }> }) => void) | null
  onend: (() => void) | null; onerror: ((e: { error: string }) => void) | null
  start(): void; stop(): void
}
const SR_LANG: Record<string, string> = { 'zh-TW': 'zh-TW', vi: 'vi-VN', en: 'en-US' }

export function GuestTranscriber({ meetingId, token, languages }: { meetingId: string; token: string; languages: string[] }) {
  const t = useTranslations('MeetingRoom')
  const [on, setOn] = useState(false)
  const [starting, setStarting] = useState(false)
  const [last, setLast] = useState('')
  const [err, setErr] = useState('')
  const azureRef = useRef<AzureRecognitionController | null>(null)
  const srRef = useRef<SR | null>(null)
  const wantRef = useRef(false)
  const headers = { 'x-meeting-guest': token }

  const post = useCallback(async (content: string, lang?: string) => {
    const text = content.trim()
    if (!text) return
    setLast(text)
    await fetch('/api/meeting/lines', {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'x-meeting-guest': token },
      body: JSON.stringify({ meetingId, content: text, source_lang: lang ?? languages[0] ?? 'zh-TW' }),
    }).catch(() => {})
  }, [meetingId, token, languages])

  const stop = useCallback(async () => {
    wantRef.current = false
    setOn(false)
    try { await azureRef.current?.stop() } catch {}
    azureRef.current = null
    try { srRef.current?.stop() } catch {}
    srRef.current = null
  }, [])

  const start = useCallback(async () => {
    if (starting) return
    setStarting(true); setErr('')
    wantRef.current = true
    try {
      setAzureTokenHeaders(headers)
      const tk = await fetchAzureSpeechToken()
      if (tk.configured && tk.token && tk.region) {
        azureRef.current = await startAzureRecognition({
          token: tk.token, region: tk.region, mode: 'online', languages: languages.length ? languages : ['zh-TW'],
          onRecognized: (text, _s, lang) => { void post(text, lang) },
          onError: () => { setErr(t('transcribeFailed')); setOn(false) },
        })
        setOn(true)
        return
      }
      // 退回瀏覽器內建語音辨識
      const w = window as unknown as { SpeechRecognition?: new () => SR; webkitSpeechRecognition?: new () => SR }
      const Ctor = w.SpeechRecognition ?? w.webkitSpeechRecognition
      if (!Ctor) { setErr(t('transcribeUnsupported')); return }
      const run = () => {
        const rec = new Ctor()
        rec.lang = SR_LANG[languages[0]] ?? 'zh-TW'
        rec.continuous = true
        rec.interimResults = false
        rec.onresult = e => {
          for (let i = e.resultIndex; i < e.results.length; i++) if (e.results[i].isFinal) void post(e.results[i][0].transcript)
        }
        rec.onerror = e => { if (e.error === 'not-allowed') { wantRef.current = false; setErr(t('transcribeFailed')); setOn(false) } }
        rec.onend = () => { if (wantRef.current) setTimeout(run, 300) }
        srRef.current = rec
        rec.start()
      }
      run()
      setOn(true)
    } catch {
      setErr(t('transcribeFailed'))
    } finally { setStarting(false) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [starting, languages, post, t, token])

  // 加入後自動開始記錄；離開頁面時停止
  useEffect(() => {
    void start()
    return () => { void stop() }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meetingId])

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-card px-3 py-2 text-xs">
      {on
        ? <span className="flex items-center gap-1.5 text-red-600"><span className="h-2 w-2 animate-pulse rounded-full bg-red-500" />{t('transcribeOn')}</span>
        : <span className="text-gray-500">{t('transcribeOff')}</span>}
      <Button size="sm" variant="outline" onClick={on ? stop : start} disabled={starting} className="h-7 gap-1.5">
        {starting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : on ? <MicOff className="h-3.5 w-3.5" /> : <Mic className="h-3.5 w-3.5" />}
        {on ? t('transcribePause') : t('transcribeStart')}
      </Button>
      {last && <span className="min-w-0 flex-1 truncate text-gray-500">「{last}」</span>}
      {err && <span className="w-full text-red-600">{err}</span>}
    </div>
  )
}
