'use client'

import { useEffect, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Bot, Loader2, Send, ExternalLink, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { textareaCls } from './shared'

interface Msg { role: 'user' | 'assistant'; content: string; sources?: { url: string; title: string }[] }

const STORAGE_KEY = 'affairs-assistant-chat'

export function AssistantTab() {
  const t = useTranslations('AffairsX')
  const [msgs, setMsgs] = useState<Msg[]>([])
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const endRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    try { const s = sessionStorage.getItem(STORAGE_KEY); if (s) setMsgs(JSON.parse(s)) } catch {}
  }, [])
  useEffect(() => {
    try { sessionStorage.setItem(STORAGE_KEY, JSON.stringify(msgs)) } catch {}
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [msgs])

  const send = async (text: string) => {
    const q = text.trim()
    if (!q || busy) return
    const next: Msg[] = [...msgs, { role: 'user', content: q }]
    setMsgs(next); setInput(''); setBusy(true); setErr('')
    const res = await fetch('/api/affairs/ai/assistant', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: next.map(({ role, content }) => ({ role, content })) }),
    })
    const d = await res.json().catch(() => ({}))
    setBusy(false)
    if (!res.ok) { setErr(d.error ?? res.statusText); return }
    setMsgs([...next, { role: 'assistant', content: d.reply, sources: d.sources }])
  }

  const prompts = ['p1', 'p2', 'p3', 'p4', 'p5', 'p6'].map(k => t(`prompt.${k}`))

  return (
    <Card className="p-4 flex flex-col gap-3 min-h-[60vh]">
      <div className="flex items-center gap-2">
        <Bot className="h-5 w-5 text-primary" />
        <div className="flex-1">
          <div className="font-semibold">{t('assistantTitle')}</div>
          <div className="text-xs text-muted-foreground">{t('assistantDesc')}</div>
        </div>
        {msgs.length > 0 && <Button size="sm" variant="ghost" className="gap-1" onClick={() => setMsgs([])}><Trash2 className="h-3.5 w-3.5" />{t('clearChat')}</Button>}
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto max-h-[60vh]">
        {msgs.length === 0 && (
          <div className="grid gap-2 sm:grid-cols-2">
            {prompts.map(p => (
              <button key={p} onClick={() => send(p)} className="text-left text-sm rounded-lg border p-3 hover:bg-muted transition-colors">{p}</button>
            ))}
          </div>
        )}
        {msgs.map((m, i) => (
          <div key={i} className={m.role === 'user' ? 'flex justify-end' : ''}>
            <div className={`rounded-xl px-3 py-2 text-sm whitespace-pre-wrap max-w-[90%] ${m.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
              {m.content}
              {m.sources && m.sources.length > 0 && (
                <div className="mt-2 pt-2 border-t border-border/50 space-y-0.5">
                  {m.sources.map(s => (
                    <a key={s.url} href={s.url} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-xs text-primary hover:underline">
                      <ExternalLink className="h-3 w-3 shrink-0" /><span className="truncate">{s.title}</span>
                    </a>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
        {busy && <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />{t('thinking')}</div>}
        {err && <p className="text-sm text-red-600">{err}</p>}
        <div ref={endRef} />
      </div>

      <div className="flex gap-2 items-end">
        <textarea className={`${textareaCls} flex-1`} value={input} onChange={e => setInput(e.target.value)} placeholder={t('askPh')}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); send(input) } }} />
        <Button onClick={() => send(input)} disabled={busy || !input.trim()} className="gap-1"><Send className="h-4 w-4" />{t('send')}</Button>
      </div>
    </Card>
  )
}
