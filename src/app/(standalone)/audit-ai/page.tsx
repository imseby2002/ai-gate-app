'use client'

import { useState, useEffect, useRef, type ChangeEvent } from 'react'
import Link from 'next/link'
import {
  ClipboardCheck, Loader2, AlertCircle, Send, Plus, Trash2,
  BookOpen, X, MessageCircle, Lightbulb, Compass, ScrollText,
  Camera, Image as ImageIcon, Sparkles, Store, ArrowRight,
  CheckCircle2, RefreshCw
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'

interface ChatLite { id: string; store: string; title: string; mode: string; updated_at: string }
interface Msg { id?: string; role: string; content: string; suggestion: string; photo_url?: string }
interface Know { id: string; kind: string; title: string; content: string }
const KIND_LABELS: Record<string, string> = {
  sop: 'SOP 流程規範',
  ergonomics: '人體工學與擺放',
  hygiene: '環境衛生標準',
  rules: '罰則規章',
  other: '補充資料',
}

export default function AuditAiPage() {
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null)
  const [chats, setChats] = useState<ChatLite[]>([])
  const [chatId, setChatId] = useState('')
  const [messages, setMessages] = useState<Msg[]>([])
  const [mode, setMode] = useState<'discuss' | 'guide'>('discuss')
  const [suggest, setSuggest] = useState(false)
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [showKnow, setShowKnow] = useState(false)
  const [stores, setStores] = useState<string[]>([])
  const [store, setStore] = useState('')
  const [photoPreview, setPhotoPreview] = useState<string>('')
  const [summarizing, setSummarizing] = useState(false)
  const [logNotice, setLogNotice] = useState('')

  const scrollRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    // 取得門市清單
    fetch('/api/inv/stores').then(r => r.ok ? r.json() : null).then(d => {
      if (d?.stores) {
        setStores(d.stores)
        if (d.stores[0]) setStore(d.stores[0])
      }
    }).catch(() => {})

    // 取得歷史對話
    fetch('/api/audit/chats')
      .then(r => {
        if (r.status === 403) { setIsAdmin(false); return null }
        setIsAdmin(true)
        return r.json()
      })
      .then(d => { if (d) setChats(d.chats ?? []) })
  }, [])

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages])

  const loadChat = async (id: string) => {
    setChatId(id)
    const res = await fetch(`/api/audit/chats?id=${id}`)
    if (res.ok) {
      const d = await res.json()
      setMessages(d.messages ?? [])
      if (d.chat?.mode) setMode(d.chat.mode === 'guide' ? 'guide' : 'discuss')
      if (d.chat?.store) setStore(d.chat.store)
    }
  }

  const newChat = () => {
    setChatId('')
    setMessages([])
    setPhotoPreview('')
  }

  const refreshChats = () => {
    fetch('/api/audit/chats').then(r => r.ok ? r.json() : { chats: [] }).then(d => setChats(d.chats ?? []))
  }

  const delChat = async (id: string) => {
    await fetch('/api/audit/chats', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id })
    })
    if (id === chatId) newChat()
    refreshChats()
  }

  const handlePhotoSelect = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      setPhotoPreview(reader.result as string)
    }
    reader.readAsDataURL(file)
    e.target.value = ''
  }

  const send = async (customMessage?: string) => {
    const messageToSend = (customMessage !== undefined ? customMessage : input).trim()
    if ((!messageToSend && !photoPreview) || sending) return

    setInput('')
    const photoSending = photoPreview
    setPhotoPreview('')
    setSending(true)

    setMessages(m => [...m, {
      role: 'user',
      content: messageToSend || '（上傳現場照片並請求診斷）',
      suggestion: '',
      photo_url: photoSending,
    }])

    const res = await fetch('/api/audit/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        store,
        message: messageToSend,
        mode,
        suggest,
        photo_url: photoSending,
      })
    })

    setSending(false)
    const d = await res.json().catch(() => ({}))
    if (!res.ok) {
      setMessages(m => [...m, {
        role: 'assistant',
        content: `⚠️ ${d.error ?? '發送失敗'}`,
        suggestion: ''
      }])
      return
    }

    if (!chatId) {
      setChatId(d.chat_id)
      refreshChats()
    }

    setMessages(m => [...m, {
      role: 'assistant',
      content: d.reply,
      suggestion: d.suggestion ?? ''
    }])
  }

  // 手動生成日誌
  const handleSummarizeToLog = async () => {
    if (!chatId) return
    setSummarizing(true)
    setLogNotice('')
    const res = await fetch('/api/audit/logs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId })
    })
    setSummarizing(false)
    if (res.ok) {
      setLogNotice('已自動摘要並存入稽核日誌！')
      setTimeout(() => setLogNotice(''), 3500)
    }
  }

  if (isAdmin === false) {
    return (
      <div className="flex h-full items-center justify-center p-8">
        <div className="text-center space-y-2">
          <AlertCircle className="h-12 w-12 mx-auto text-amber-400" />
          <p className="font-semibold">僅稽核單位可使用稽核討論AI</p>
        </div>
      </div>
    )
  }

  // 取得最新一則建議內容
  const latestSuggestion = [...messages].reverse().find(m => m.role === 'assistant' && m.suggestion)?.suggestion ?? ''

  // 拆解建議為條列項目
  const suggestionItems = latestSuggestion
    ? latestSuggestion.split(/\n+/).map(s => s.trim()).filter(Boolean)
    : []

  return (
    <div className="max-w-7xl mx-auto px-4 py-4 h-[calc(100vh-2rem)] flex flex-col">
      {/* 頂部導覽列 */}
      <div className="flex items-center gap-3 mb-3">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center text-white shadow-sm">
          <ClipboardCheck className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            稽核討論AI
            <span className="text-xs font-normal px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300">
              專家顧問
            </span>
          </h1>
        </div>

        {/* 門市選擇 */}
        <div className="flex items-center gap-1.5 ml-4">
          <Store className="h-4 w-4 text-muted-foreground" />
          <Input
            list="store-list"
            value={store}
            onChange={e => setStore(e.target.value)}
            className="w-32 h-8 text-xs"
            placeholder="選擇或輸入門市"
          />
          <datalist id="store-list">
            {stores.map(s => <option key={s} value={s} />)}
          </datalist>
        </div>

        {/* 功能導航入口 */}
        <div className="ml-auto flex items-center gap-2">
          <Button size="sm" variant="outline" className="gap-1.5 h-8 text-xs" onClick={() => setShowKnow(true)}>
            <BookOpen className="h-3.5 w-3.5" />
            知識庫
          </Button>
          <Link href="/audit-logs">
            <Button size="sm" variant="outline" className="gap-1.5 h-8 text-xs">
              <ScrollText className="h-3.5 w-3.5" />
              稽核日誌
            </Button>
          </Link>
          <Link href="/audit-inspection">
            <Button size="sm" variant="outline" className="gap-1.5 h-8 text-xs text-primary border-primary/30">
              <ClipboardCheck className="h-3.5 w-3.5" />
              現場巡檢
            </Button>
          </Link>
        </div>
      </div>

      {/* 主工作區 */}
      <div className="flex gap-3 flex-1 min-h-0">
        {/* 左側：對話歷史清單 */}
        <div className="w-56 shrink-0 flex flex-col gap-2 min-h-0 hidden md:flex">
          <Button size="sm" className="gap-1.5 w-full" onClick={newChat}>
            <Plus className="h-4 w-4" />
            新對話
          </Button>
          <div className="flex-1 overflow-y-auto space-y-1 pr-1 border rounded-lg p-1.5 bg-muted/20">
            {chats.length === 0 ? (
              <div className="text-xs text-center text-muted-foreground py-6">尚無歷史對話</div>
            ) : (
              chats.map(c => (
                <div
                  key={c.id}
                  className={`group flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs cursor-pointer transition-colors ${
                    c.id === chatId ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-900 dark:text-amber-200 font-medium' : 'hover:bg-muted'
                  }`}
                  onClick={() => loadChat(c.id)}
                >
                  <MessageCircle className="h-3.5 w-3.5 shrink-0 opacity-60" />
                  <span className="truncate flex-1">{c.title || '無標題對話'}</span>
                  <button
                    onClick={e => { e.stopPropagation(); delChat(c.id) }}
                    className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-red-500"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

        {/* 中右區：主畫面 */}
        <div className="flex-1 flex flex-col min-h-0">
          {/* 模式按鈕區：討論式、導引式、建議開關 */}
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <div className="flex gap-1 p-0.5 bg-muted rounded-lg border">
              <button
                onClick={() => setMode('discuss')}
                className={`flex items-center gap-1 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                  mode === 'discuss' ? 'bg-background text-primary shadow-xs' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <MessageCircle className="h-3.5 w-3.5" />
                討論
              </button>
              <button
                onClick={() => setMode('guide')}
                className={`flex items-center gap-1 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                  mode === 'guide' ? 'bg-background text-primary shadow-xs' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <Compass className="h-3.5 w-3.5" />
                導引
              </button>
            </div>

            {/* 建議按鈕（開關） */}
            <button
              onClick={() => setSuggest(v => !v)}
              className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                suggest
                  ? 'bg-amber-50 dark:bg-amber-950/50 text-amber-800 dark:text-amber-300 border-amber-300 shadow-xs'
                  : 'bg-background text-muted-foreground border-border hover:bg-muted'
              }`}
            >
              <Lightbulb className="h-3.5 w-3.5 text-amber-500" />
              建議答案區 {suggest ? '已開啟 (1/3)' : '已關閉'}
            </button>

            {chatId && messages.length >= 2 && (
              <Button
                size="sm"
                variant="ghost"
                className="h-7 text-xs gap-1 ml-auto text-muted-foreground hover:text-primary"
                onClick={handleSummarizeToLog}
                disabled={summarizing}
              >
                {summarizing ? <Loader2 className="h-3 w-3 animate-spin" /> : <ScrollText className="h-3 w-3" />}
                生成日誌
              </Button>
            )}
            {logNotice && (
              <span className="text-xs text-emerald-600 font-medium animate-pulse">{logNotice}</span>
            )}
          </div>

          {/* 版型區域：依 suggest 開關，左 2/3、右 1/3 */}
          <div className="flex flex-col md:flex-row gap-3 flex-1 min-h-0">
            {/* 左側對話區：佔 2/3（或佔全部當 suggest 關閉） */}
            <div className={`flex flex-col min-h-0 ${suggest ? 'md:flex-[2]' : 'flex-1'}`}>
              <div ref={scrollRef} className="flex-1 overflow-y-auto space-y-3 pr-1 border rounded-xl p-3 bg-muted/10">
                {messages.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center p-6 text-muted-foreground">
                    <div className="w-12 h-12 rounded-2xl bg-amber-50 dark:bg-amber-950/40 flex items-center justify-center text-amber-600 mb-3">
                      <Sparkles className="h-6 w-6" />
                    </div>
                    <p className="font-medium text-foreground">稽核專家對話已就緒</p>
                    <p className="text-xs mt-1 max-w-md">
                      可直接詢問操作流程、動線設計、人體工學（防手腕受傷/轉身過頻）、吧台擺設美觀、原料作廢防弊，或拍照上傳現場照片直接討論。
                    </p>
                    <div className="flex flex-wrap justify-center gap-2 mt-4 max-w-lg">
                      {[
                        '水吧封口機與冰槽動線如何調整才符合人體工學？',
                        '現場發現已按作廢的原料仍在吧台，標準處置流程為何？',
                        '抹布分區與隨手清（Clean as you go）稽核重點？',
                        '門市公務機與個人 Zalo 私群該如何防杜私下收款？',
                      ].map((hint, idx) => (
                        <button
                          key={idx}
                          onClick={() => send(hint)}
                          className="text-xs px-2.5 py-1.5 rounded-lg border bg-background hover:bg-muted text-left transition-colors"
                        >
                          {hint}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  messages.map((m, idx) => (
                    <div
                      key={idx}
                      className={`flex flex-col ${m.role === 'user' ? 'items-end' : 'items-start'}`}
                    >
                      <div
                        className={`max-w-[88%] rounded-2xl px-4 py-2.5 text-sm shadow-2xs whitespace-pre-wrap ${
                          m.role === 'user'
                            ? 'bg-primary text-primary-foreground rounded-tr-xs'
                            : 'bg-card border text-card-foreground rounded-tl-xs'
                        }`}
                      >
                        {m.photo_url && (
                          <div className="mb-2">
                            <img
                              src={m.photo_url}
                              alt="現場照片"
                              className="max-h-56 rounded-lg border object-cover"
                            />
                          </div>
                        )}
                        <div>{m.content}</div>
                      </div>
                    </div>
                  ))
                )}
                {sending && (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground py-2 pl-2">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    稽核專家思考分析中…
                  </div>
                )}
              </div>

              {/* 照片預覽條 */}
              {photoPreview && (
                <div className="relative inline-block mt-2">
                  <img src={photoPreview} alt="預覽" className="h-16 w-24 object-cover rounded-lg border" />
                  <button
                    onClick={() => setPhotoPreview('')}
                    className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-red-500 text-white flex items-center justify-center text-xs shadow-sm"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              )}

              {/* 輸入框 */}
              <div className="flex items-center gap-2 pt-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  hidden
                  onChange={handlePhotoSelect}
                />
                <Button
                  size="icon"
                  variant="outline"
                  className="h-10 w-10 shrink-0 text-muted-foreground hover:text-foreground"
                  onClick={() => fileInputRef.current?.click()}
                  title="拍照或上傳巡檢照片"
                >
                  <Camera className="h-4 w-4" />
                </Button>
                <Input
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }}
                  placeholder="輸入提問或與專家探討流程動線、擺放、安全合規..."
                  className="flex-1 h-10 text-sm"
                />
                <Button
                  size="icon"
                  className="h-10 w-10 shrink-0"
                  onClick={() => send()}
                  disabled={sending || (!input.trim() && !photoPreview)}
                >
                  {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                </Button>
              </div>
            </div>

            {/* 右側：建議答案區（佔 1/3，當 suggest 為 true 時顯示） */}
            {suggest && (
              <div className="md:flex-[1] flex flex-col min-h-0 border rounded-xl p-3 bg-amber-50/40 dark:bg-amber-950/20">
                <div className="flex items-center justify-between border-b pb-2 mb-2">
                  <div className="flex items-center gap-1.5 font-semibold text-xs text-amber-900 dark:text-amber-200">
                    <Lightbulb className="h-4 w-4 text-amber-600" />
                    建議與答案專區 (1/3)
                  </div>
                  <span className="text-[10px] text-muted-foreground">點擊卡片可直接追問</span>
                </div>

                <div className="flex-1 overflow-y-auto space-y-2 pr-1 text-xs">
                  {suggestionItems.length === 0 ? (
                    <div className="text-center text-muted-foreground py-10">
                      發送訊息後，專家建議與答案將獨立顯示於此。
                    </div>
                  ) : (
                    suggestionItems.map((item, idx) => (
                      <Card key={idx} className="p-2.5 bg-background shadow-2xs border-amber-200 dark:border-amber-900/50 space-y-2">
                        <div className="leading-relaxed text-foreground font-medium">
                          {item}
                        </div>
                        <div className="flex items-center gap-1.5 pt-1 border-t">
                          <button
                            onClick={() => send(`針對這項建議「${item.replace(/^[0-9\.\-\*・\s]+/, '')}」，如何更具體在門市執行？`)}
                            className="text-[11px] text-amber-700 hover:text-amber-800 dark:text-amber-400 flex items-center gap-0.5"
                          >
                            <MessageCircle className="h-3 w-3" />
                            引用追問
                          </button>
                          <button
                            onClick={() => {
                              setInput(prev => prev ? `${prev}（參考建議：${item}）` : `請針對「${item}」進行人體工學調整分析`)
                            }}
                            className="text-[11px] text-muted-foreground hover:text-foreground ml-auto flex items-center gap-0.5"
                          >
                            <ArrowRight className="h-3 w-3" />
                            帶入輸入框
                          </button>
                        </div>
                      </Card>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 知識庫彈窗（隨時補充訓練資料） */}
      {showKnow && <KnowledgeModal onClose={() => setShowKnow(false)} />}
    </div>
  )
}

// 知識庫管理彈窗
function KnowledgeModal({ onClose }: { onClose: () => void }) {
  const [items, setItems] = useState<Know[]>([])
  const [loading, setLoading] = useState(true)
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [kind, setKind] = useState('sop')
  const [adding, setAdding] = useState(false)

  const load = () => {
    setLoading(true)
    fetch('/api/audit/knowledge')
      .then(r => r.ok ? r.json() : { items: [] })
      .then(d => { setItems(d.items ?? []); setLoading(false) })
  }

  useEffect(() => { load() }, [])

  const handleAdd = async () => {
    if (!title.trim() || !content.trim()) return
    setAdding(true)
    const res = await fetch('/api/audit/knowledge', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ kind, title, content })
    })
    setAdding(false)
    if (res.ok) {
      setTitle('')
      setContent('')
      load()
    }
  }

  const handleDelete = async (id: string) => {
    await fetch('/api/audit/knowledge', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id })
    })
    load()
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-background border rounded-2xl w-full max-w-2xl p-5 max-h-[85vh] flex flex-col shadow-xl">
        <div className="flex items-center justify-between pb-3 border-b">
          <div className="flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-amber-600" />
            <h2 className="text-base font-bold">稽核專家知識庫・隨時補充訓練資料</h2>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* 新增區 */}
        <div className="space-y-3 py-3 border-b">
          <div className="flex gap-2">
            <select
              value={kind}
              onChange={e => setKind(e.target.value)}
              className="h-9 px-2 text-xs border rounded-md bg-background"
            >
              <option value="sop">SOP 流程規範</option>
              <option value="ergonomics">人體工學與擺放</option>
              <option value="hygiene">環境衛生標準</option>
              <option value="rules">罰則規章</option>
              <option value="other">補充資料</option>
            </select>
            <Input
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="標題（如：水吧封口機擺放間距要求、假作廢罰則標準）"
              className="h-9 text-xs flex-1"
            />
          </div>
          <textarea
            value={content}
            onChange={e => setContent(e.target.value)}
            placeholder="請貼上規範內容、人體工學高度尺寸、罰則說明或 SOP 細節..."
            className="w-full h-20 p-2 text-xs border rounded-md bg-background resize-none"
          />
          <div className="flex justify-end">
            <Button size="sm" onClick={handleAdd} disabled={adding || !title.trim() || !content.trim()} className="gap-1 text-xs">
              {adding ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}
              新增至知識庫
            </Button>
          </div>
        </div>

        {/* 清單區 */}
        <div className="flex-1 overflow-y-auto py-2 space-y-2">
          {loading ? (
            <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
          ) : items.length === 0 ? (
            <div className="text-center text-xs text-muted-foreground py-6">目前尚未建立補充訓練資料</div>
          ) : (
            items.map(it => (
              <div key={it.id} className="p-3 border rounded-lg bg-muted/20 space-y-1 group">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 font-medium">
                    {KIND_LABELS[it.kind] || it.kind}
                  </span>
                  <span className="font-semibold text-xs text-foreground flex-1">{it.title}</span>
                  <button onClick={() => handleDelete(it.id)} className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-red-500">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
                <p className="text-xs text-muted-foreground whitespace-pre-wrap line-clamp-3">{it.content}</p>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
