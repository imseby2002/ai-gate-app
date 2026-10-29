'use client'

/** 會議文字聊天＋檔案上傳（成員與訪客共用）。即時通知走 Supabase broadcast，另每 5 秒補抓一次。 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Send, Paperclip, Loader2, FileText, Download } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

interface Msg {
  id: string; sender_kind: string; sender_id: string; sender_name: string; body: string
  file_path: string | null; file_name: string | null; file_type: string | null; file_size: number | null; file_url: string | null
  created_at: string
}

const MAX = 50 * 1024 * 1024
const fmtSize = (n: number | null) => !n ? '' : n > 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.ceil(n / 1024)} KB`

export function MeetingChat({ meetingId, authHeaders, className, readOnly }: { meetingId: string; authHeaders?: Record<string, string>; className?: string; readOnly?: boolean }) {
  const t = useTranslations('MeetingRoom')
  const [msgs, setMsgs] = useState<Msg[]>([])
  const [me, setMe] = useState<{ kind: string; id: string } | null>(null)
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const fileRef = useRef<HTMLInputElement | null>(null)
  const bottomRef = useRef<HTMLDivElement | null>(null)
  const chRef = useRef<ReturnType<ReturnType<typeof createClient>['channel']> | null>(null)
  const headers = useRef(authHeaders ?? {})
  headers.current = authHeaders ?? {}

  const load = useCallback(async () => {
    const res = await fetch(`/api/meeting/messages?meetingId=${meetingId}`, { headers: headers.current })
    if (!res.ok) return
    const j = await res.json() as { me: { kind: string; id: string }; messages: Msg[] }
    setMe(j.me)
    setMsgs(prev => (prev.length === j.messages.length && prev.at(-1)?.id === j.messages.at(-1)?.id ? prev : j.messages))
  }, [meetingId])

  useEffect(() => {
    void load()
    const timer = setInterval(load, 5000)
    const supabase = createClient()
    const ch = supabase.channel(`meetchat:${meetingId}`, { config: { broadcast: { self: false } } })
      .on('broadcast', { event: 'new' }, () => { void load() })
      .subscribe()
    chRef.current = ch
    return () => { clearInterval(timer); void supabase.removeChannel(ch); chRef.current = null }
  }, [meetingId, load])

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }) }, [msgs.length])

  const post = async (payload: Record<string, unknown>) => {
    const res = await fetch('/api/meeting/messages', {
      method: 'POST', headers: { 'Content-Type': 'application/json', ...headers.current },
      body: JSON.stringify({ meetingId, ...payload }),
    })
    if (!res.ok) { setErr(t('sendFailed')); return false }
    void chRef.current?.send({ type: 'broadcast', event: 'new', payload: {} })
    await load()
    return true
  }

  const sendText = async () => {
    const body = text.trim()
    if (!body || busy) return
    setBusy(true); setErr('')
    try { if (await post({ body })) setText('') } finally { setBusy(false) }
  }

  const sendFile = async (file: File) => {
    if (file.size > MAX) { setErr(t('fileTooLarge')); return }
    setBusy(true); setErr('')
    try {
      const res = await fetch('/api/meeting/upload-url', {
        method: 'POST', headers: { 'Content-Type': 'application/json', ...headers.current },
        body: JSON.stringify({ meetingId, name: file.name, size: file.size }),
      })
      if (!res.ok) { setErr(t('uploadFailed')); return }
      const { path, token } = await res.json() as { path: string; token: string }
      const { error } = await createClient().storage.from('meeting-files').uploadToSignedUrl(path, token, file, { contentType: file.type || 'application/octet-stream' })
      if (error) { setErr(t('uploadFailed')); return }
      await post({ body: text.trim(), file: { path, name: file.name, type: file.type, size: file.size } })
      setText('')
    } finally { setBusy(false); if (fileRef.current) fileRef.current.value = '' }
  }

  return (
    <div className={`flex flex-col rounded-lg border bg-card ${className ?? ''}`}>
      <div className="px-3 py-2 border-b text-sm font-medium">{t('chatTitle')}</div>
      <div className="flex-1 min-h-[180px] max-h-[360px] overflow-y-auto p-3 space-y-2">
        {msgs.length === 0 && <p className="text-xs text-gray-400 text-center py-6">{t('chatEmpty')}</p>}
        {msgs.map(m => {
          const mine = me && m.sender_kind === me.kind && m.sender_id === me.id
          const isImg = m.file_type?.startsWith('image/') && m.file_url
          return (
            <div key={m.id} className={`flex flex-col ${mine ? 'items-end' : 'items-start'}`}>
              <div className="text-[10px] text-gray-400">
                {m.sender_name}{m.sender_kind === 'guest' ? `（${t('guestTag')}）` : ''} · {new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </div>
              <div className={`max-w-[85%] rounded-lg px-3 py-1.5 text-sm whitespace-pre-wrap break-words ${mine ? 'bg-blue-600 text-white' : 'bg-gray-100 dark:bg-gray-800'}`}>
                {m.body}
                {m.file_path && (
                  <div className={m.body ? 'mt-1.5' : ''}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    {isImg && <a href={m.file_url!} target="_blank" rel="noreferrer"><img src={m.file_url!} alt={m.file_name ?? ''} className="max-h-48 rounded" /></a>}
                    <a href={m.file_url ?? '#'} target="_blank" rel="noreferrer" download={m.file_name ?? undefined}
                      className={`mt-1 flex items-center gap-1.5 text-xs underline ${mine ? 'text-white' : 'text-blue-600'}`}>
                      {isImg ? <Download className="h-3.5 w-3.5" /> : <FileText className="h-3.5 w-3.5" />}{m.file_name} {fmtSize(m.file_size)}
                    </a>
                  </div>
                )}
              </div>
            </div>
          )
        })}
        <div ref={bottomRef} />
      </div>
      {err && <p className="px-3 text-xs text-red-600">{err}</p>}
      {!readOnly && <div className="flex gap-2 p-2 border-t">
        <input ref={fileRef} type="file" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) void sendFile(f) }} />
        <Button size="icon" variant="outline" onClick={() => fileRef.current?.click()} disabled={busy} title={t('attach')} className="shrink-0">
          <Paperclip className="h-4 w-4" />
        </Button>
        <Input value={text} onChange={e => setText(e.target.value)} placeholder={t('chatPlaceholder')}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); void sendText() } }} />
        <Button size="icon" onClick={sendText} disabled={busy || !text.trim()} className="shrink-0">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </Button>
      </div>}
    </div>
  )
}
