'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { FlaskConical, Loader2, AlertCircle, Send, Plus, Trash2, BookOpen, X, MessageCircle, Lightbulb, Compass, ScrollText } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'

interface ChatLite { id: string; title: string; mode: string; updated_at: string }
interface Msg { role: string; content: string; suggestion: string }
interface Know { id: string; kind: string; title: string; content: string }
const KIND_LABEL: Record<string, string> = { recipe: '配方', product: '公司產品', external: '外部產品', note: '筆記' }

export default function RdAiPage() {
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null)
  const [chats, setChats] = useState<ChatLite[]>([])
  const [chatId, setChatId] = useState('')
  const [messages, setMessages] = useState<Msg[]>([])
  const [mode, setMode] = useState<'discuss' | 'guide'>('discuss')
  const [suggest, setSuggest] = useState(false)
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [showKnow, setShowKnow] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => { fetch('/api/rd/chats').then(r => { if (r.status === 403) { setIsAdmin(false); return null } setIsAdmin(true); return r.json() }).then(d => { if (d) setChats(d.chats ?? []) }) }, [])
  useEffect(() => { scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight }) }, [messages])

  const loadChat = async (id: string) => {
    setChatId(id)
    const res = await fetch(`/api/rd/chats?id=${id}`)
    if (res.ok) { const d = await res.json(); setMessages(d.messages ?? []); setMode(d.chat.mode === 'guide' ? 'guide' : 'discuss') }
  }
  const newChat = () => { setChatId(''); setMessages([]) }
  const refreshChats = () => fetch('/api/rd/chats').then(r => r.ok ? r.json() : { chats: [] }).then(d => setChats(d.chats ?? []))
  const del = async (id: string) => { await fetch('/api/rd/chats', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) }); if (id === chatId) newChat(); refreshChats() }

  const send = async () => {
    const message = input.trim()
    if (!message || sending) return
    setInput(''); setSending(true)
    setMessages(m => [...m, { role: 'user', content: message, suggestion: '' }])
    const res = await fetch('/api/rd/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ chat_id: chatId, message, mode, suggest }) })
    setSending(false)
    const d = await res.json().catch(() => ({}))
    if (!res.ok) { setMessages(m => [...m, { role: 'assistant', content: `⚠️ ${d.error ?? '失敗'}`, suggestion: '' }]); return }
    if (!chatId) { setChatId(d.chat_id); refreshChats() }
    setMessages(m => [...m, { role: 'assistant', content: d.reply, suggestion: d.suggestion ?? '' }])
  }

  if (isAdmin === false) return (
    <div className="flex h-full items-center justify-center p-8">
      <div className="text-center space-y-2"><AlertCircle className="h-12 w-12 mx-auto text-amber-400" /><p className="font-semibold">僅研發單位可使用研發討論AI</p></div>
    </div>
  )

  const latestSuggestion = [...messages].reverse().find(m => m.role === 'assistant' && m.suggestion)?.suggestion ?? ''

  return (
    <div className="max-w-6xl mx-auto px-4 py-4 h-[calc(100vh-2rem)] flex flex-col">
      <div className="flex items-center gap-3 mb-3">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center"><FlaskConical className="h-5 w-5 text-white" /></div>
        <div><h1 className="text-xl font-bold">研發討論AI</h1></div>
        <div className="ml-auto flex items-center gap-2">
          <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setShowKnow(true)}><BookOpen className="h-4 w-4" />知識庫</Button>
          <Link href="/rd-logs"><Button size="sm" variant="outline" className="gap-1.5"><ScrollText className="h-4 w-4" />日誌</Button></Link>
          <Link href="/rd"><Button size="sm" variant="outline" className="gap-1.5"><FlaskConical className="h-4 w-4 text-purple-600" />配方中心</Button></Link>
        </div>
      </div>

      <div className="flex gap-3 flex-1 min-h-0">
        {/* 對話歷史 */}
        <div className="w-52 shrink-0 flex flex-col gap-2 min-h-0">
          <Button size="sm" className="gap-1.5" onClick={newChat}><Plus className="h-4 w-4" />新對話</Button>
          <div className="flex-1 overflow-y-auto space-y-1">
            {chats.map(c => (
              <div key={c.id} className={`group flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs cursor-pointer ${c.id === chatId ? 'bg-purple-50 text-purple-700' : 'hover:bg-gray-100'}`} onClick={() => loadChat(c.id)}>
                <MessageCircle className="h-3.5 w-3.5 shrink-0 opacity-50" />
                <span className="truncate flex-1">{c.title}</span>
                <button onClick={e => { e.stopPropagation(); del(c.id) }} className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-500"><Trash2 className="h-3.5 w-3.5" /></button>
              </div>
            ))}
          </div>
        </div>

        {/* 主畫面 */}
        <div className="flex-1 flex flex-col min-h-0">
          <div className="flex items-center gap-2 mb-2">
            <div className="flex gap-1 p-0.5 bg-muted rounded-lg">
              <button onClick={() => setMode('discuss')} className={`flex items-center gap-1 px-3 py-1.5 rounded-md text-sm font-medium ${mode === 'discuss' ? 'bg-card text-primary shadow-sm' : 'text-muted-foreground'}`}><MessageCircle className="h-3.5 w-3.5" />討論</button>
              <button onClick={() => setMode('guide')} className={`flex items-center gap-1 px-3 py-1.5 rounded-md text-sm font-medium ${mode === 'guide' ? 'bg-card text-primary shadow-sm' : 'text-muted-foreground'}`}><Compass className="h-3.5 w-3.5" />引導</button>
            </div>
            <button onClick={() => setSuggest(v => !v)} className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-medium border ${suggest ? 'bg-amber-50 text-amber-700 border-amber-300' : 'text-gray-500 border-gray-200'}`}><Lightbulb className="h-3.5 w-3.5" />建議</button>
            <span className="text-xs text-gray-400 ml-1">{mode === 'discuss' ? '討論式：一起討論、不直接給答案' : '引導式：一步步帶你推進'}{suggest ? '｜右側顯示建議答案' : ''}</span>
          </div>

          <div className="flex gap-3 flex-1 min-h-0">
            <div className={`flex flex-col min-h-0 ${suggest ? 'flex-[2]' : 'flex-1'}`}>
              <div ref={scrollRef} className="flex-1 overflow-y-auto space-y-3 pr-1">
                {messages.length === 0 && <div className="text-center text-gray-400 text-sm py-10">與研發討論AI 開始對話。它熟悉你的配方與知識庫。</div>}
                {messages.map((m, i) => (
                  <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm whitespace-pre-wrap ${m.role === 'user' ? 'bg-purple-600 text-white' : 'bg-gray-100 text-gray-800'}`}>{m.content}</div>
                  </div>
                ))}
                {sending && <div className="flex justify-start"><div className="bg-gray-100 rounded-2xl px-3 py-2"><Loader2 className="h-4 w-4 animate-spin text-gray-400" /></div></div>}
              </div>
              <div className="flex gap-2 pt-2">
                <Input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }} placeholder="輸入問題或想討論的主題…" disabled={sending} />
                <Button onClick={send} disabled={sending || !input.trim()} className="gap-1.5"><Send className="h-4 w-4" /></Button>
              </div>
            </div>

            {suggest && (
              <div className="flex-1 min-h-0 flex flex-col">
                <div className="text-xs font-medium text-amber-700 flex items-center gap-1 mb-1"><Lightbulb className="h-3.5 w-3.5" />建議答案區</div>
                <Card className="flex-1 overflow-y-auto p-3 text-sm text-gray-700 whitespace-pre-wrap bg-amber-50/40 border-amber-200">
                  {latestSuggestion || <span className="text-gray-400">按「建議」後，AI 的具體建議會顯示在這裡。你也可以根據建議繼續詢問。</span>}
                </Card>
              </div>
            )}
          </div>
        </div>
      </div>

      {showKnow && <KnowledgePanel onClose={() => setShowKnow(false)} />}
    </div>
  )
}

function KnowledgePanel({ onClose }: { onClose: () => void }) {
  const [items, setItems] = useState<Know[]>([])
  const [kind, setKind] = useState('note')
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [busy, setBusy] = useState(false)
  const load = () => fetch('/api/rd/knowledge').then(r => r.ok ? r.json() : { items: [] }).then(d => setItems(d.items ?? []))
  useEffect(() => { load() }, [])

  const add = async () => {
    if (!content.trim()) return
    setBusy(true)
    await fetch('/api/rd/knowledge', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ kind, title, content }) })
    setBusy(false); setTitle(''); setContent(''); load()
  }
  const del = async (id: string) => { await fetch('/api/rd/knowledge', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) }); load() }

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/40" onClick={onClose}>
      <div className="bg-card w-full max-w-md h-full overflow-y-auto p-5 space-y-3" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between"><h3 className="font-semibold flex items-center gap-1.5"><BookOpen className="h-4 w-4" />研發知識庫</h3><button onClick={onClose}><X className="h-5 w-5 text-gray-400" /></button></div>
        <p className="text-xs text-gray-500">補充訓練資料（配方、公司產品、外部相關產品、筆記），AI 對話時會參考。</p>
        <div className="space-y-2 border rounded-lg p-3 bg-gray-50">
          <div className="flex gap-2">
            <select value={kind} onChange={e => setKind(e.target.value)} className="h-9 rounded-md border px-2 text-sm">{Object.entries(KIND_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
            <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="標題（可空）" className="h-9" />
          </div>
          <textarea value={content} onChange={e => setContent(e.target.value)} placeholder="內容…" className="w-full min-h-24 rounded-md border p-2 text-sm" />
          <div className="flex justify-end"><Button size="sm" onClick={add} disabled={busy || !content.trim()} className="gap-1.5">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}加入</Button></div>
        </div>
        <div className="space-y-2">
          {items.length === 0 && <p className="text-xs text-gray-400 text-center py-4">尚無知識條目</p>}
          {items.map(it => (
            <Card key={it.id} className="p-3">
              <div className="flex items-start gap-2">
                <span className="text-[11px] px-1.5 rounded bg-gray-100 text-gray-500 shrink-0">{KIND_LABEL[it.kind] ?? it.kind}</span>
                <div className="min-w-0 flex-1">
                  {it.title && <div className="text-sm font-medium">{it.title}</div>}
                  <div className="text-xs text-gray-500 line-clamp-3 whitespace-pre-wrap">{it.content}</div>
                </div>
                <button onClick={() => del(it.id)} className="text-gray-400 hover:text-red-500 shrink-0"><Trash2 className="h-4 w-4" /></button>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </div>
  )
}
