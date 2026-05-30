'use client'
import { useEffect, useRef, useState } from 'react'
import { Send, Loader2, X, Sparkles, ChevronDown, ChevronUp, Check } from 'lucide-react'

interface WebForm {
  slug: string; name?: string; template_id: string; theme_color: string
  tagline: string; hero_cta_text: string
  about: string; owner_intro: string; faq: { q: string; a: string }[]
  booking_instructions: string; cancellation_policy: string
  contact_note: string; contact_map_embed: string
  social_links: { facebook: string; instagram: string; youtube: string }
  seo_title: string; seo_description: string
}

type Updates = Partial<Omit<WebForm, 'slug' | 'contact_map_embed' | 'social_links'>>

const FIELD_LABELS: Record<string, string> = {
  template_id: '🎨 視覺模板',
  theme_color: '🎨 主題色',
  tagline: '副標語',
  about: '民宿故事',
  owner_intro: '主人介紹',
  hero_cta_text: '按鈕文字',
  booking_instructions: '訂房說明',
  cancellation_policy: '取消政策',
  contact_note: '聯絡說明',
  seo_title: 'SEO 標題',
  seo_description: 'SEO 摘要',
  faq: '常見問題',
}

const TEMPLATE_NAMES: Record<string, string> = {
  natural: '自然山居', coastal: '海濱度假', boutique: '精品時尚', zen: '日式禪意',
}

const QUICK_PROMPTS = [
  '幫我設計整個官網，包含模板、顏色和所有文案',
  '根據我的民宿特色，推薦最適合的視覺風格',
  '幫我完整寫好所有頁面文案',
  '寫一個吸引旅客的民宿故事',
  '幫我想 5 個常見問題 FAQ',
  '優化 SEO 標題和搜尋摘要',
]

interface Message {
  role: 'user' | 'assistant'
  content: string
  updates?: Record<string, unknown>
  applied?: boolean
}

interface Props {
  form: WebForm
  onApply: (updates: Updates) => void
  onClose: () => void
}

export default function AiPanel({ form, onApply, onClose }: Props) {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      content: `你好！我是你的官網設計師 ✨\n\n我可以幫你：\n• 選擇最適合的視覺模板與主題色\n• 撰寫所有頁面的文案\n• 整體設計與文案一起優化\n\n告訴我你的民宿特色、風格、目標旅客，或直接說「幫我設計整個官網」。`,
    },
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [expandedUpdates, setExpandedUpdates] = useState<number[]>([])
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function send(text?: string) {
    const msg = (text ?? input).trim()
    if (!msg || loading) return
    setInput('')

    const userMsg: Message = { role: 'user', content: msg }
    const history = [...messages, userMsg]
    setMessages(history)
    setLoading(true)

    try {
      const res = await fetch('/api/booking/website-ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: history
            .filter(m => m.role === 'user' || (m.role === 'assistant' && m !== messages[0]))
            .map(m => ({ role: m.role, content: m.content })),
          profile: {
            name: form.name ?? '',
            template_id: form.template_id,
            theme_color: form.theme_color,
            tagline: form.tagline,
            about: form.about,
            seo_title: form.seo_title,
          },
        }),
      })
      const d = await res.json()
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: d.text ?? '（無回覆）',
        updates: d.updates ?? undefined,
      }])
      if (d.updates) {
        setExpandedUpdates(prev => [...prev, history.length])
      }
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: '⚠ 發生錯誤，請再試一次' }])
    } finally {
      setLoading(false)
      inputRef.current?.focus()
    }
  }

  function applyUpdates(msgIdx: number, updates: Record<string, unknown>) {
    onApply(updates as Updates)
    setMessages(prev => prev.map((m, i) => i === msgIdx ? { ...m, applied: true } : m))
  }

  function toggleExpand(idx: number) {
    setExpandedUpdates(prev =>
      prev.includes(idx) ? prev.filter(i => i !== idx) : [...prev, idx]
    )
  }

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Panel header */}
      <div className="flex items-center justify-between px-4 py-3 border-b bg-gradient-to-r from-violet-50 to-indigo-50 shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 bg-indigo-600 rounded-lg flex items-center justify-center">
            <Sparkles className="h-3.5 w-3.5 text-white" />
          </div>
          <span className="text-sm font-semibold text-gray-800">AI 官網設計師</span>
        </div>
        <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600 rounded-md">
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3 min-h-0">
        {messages.map((msg, idx) => (
          <div key={idx}>
            <div className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed whitespace-pre-wrap
                ${msg.role === 'user'
                  ? 'bg-indigo-600 text-white rounded-br-sm'
                  : 'bg-gray-100 text-gray-800 rounded-bl-sm'}`}>
                {msg.content}
              </div>
            </div>

            {/* Updates preview */}
            {msg.updates && Object.keys(msg.updates).length > 0 && (
              <div className="mt-2 border border-indigo-100 rounded-xl overflow-hidden bg-indigo-50/50">
                <button
                  onClick={() => toggleExpand(idx)}
                  className="w-full flex items-center justify-between px-3 py-2 text-xs font-medium text-indigo-700 hover:bg-indigo-50 transition-colors">
                  <span>
                    {msg.applied ? '✓ 已套用' : `📝 ${Object.keys(msg.updates).length} 個欄位更新`}
                  </span>
                  {expandedUpdates.includes(idx) ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                </button>

                {expandedUpdates.includes(idx) && (
                  <div className="border-t border-indigo-100">
                    <div className="max-h-48 overflow-y-auto divide-y divide-indigo-50">
                      {Object.entries(msg.updates).map(([key, val]) => (
                        <div key={key} className="px-3 py-2 space-y-0.5">
                          <div className="text-[11px] font-semibold text-indigo-600 uppercase tracking-wide">
                            {FIELD_LABELS[key] ?? key}
                          </div>
                          <div className="text-xs text-gray-600 line-clamp-3 flex items-center gap-1.5">
                            {key === 'template_id'
                              ? <span className="font-medium">{TEMPLATE_NAMES[String(val)] ?? String(val)}</span>
                              : key === 'theme_color'
                                ? <><span className="inline-block w-4 h-4 rounded-full border border-gray-200 shrink-0" style={{ backgroundColor: String(val) }} /><span className="font-mono">{String(val)}</span></>
                                : key === 'faq'
                                  ? `${(val as { q: string }[]).length} 個問題`
                                  : String(val).slice(0, 120) + (String(val).length > 120 ? '…' : '')}
                          </div>
                        </div>
                      ))}
                    </div>
                    {!msg.applied && (
                      <div className="p-2 bg-white border-t border-indigo-100">
                        <button
                          onClick={() => applyUpdates(idx, msg.updates!)}
                          className="w-full py-2 rounded-lg bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700 transition-colors flex items-center justify-center gap-1.5">
                          <Check className="h-3.5 w-3.5" /> 套用到官網
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        ))}

        {loading && (
          <div className="flex justify-start">
            <div className="bg-gray-100 rounded-2xl rounded-bl-sm px-4 py-3 flex items-center gap-2">
              <Loader2 className="h-3.5 w-3.5 animate-spin text-indigo-500" />
              <span className="text-sm text-gray-500">AI 撰寫中…</span>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Quick prompts */}
      {messages.length <= 1 && (
        <div className="px-3 pb-2 flex flex-wrap gap-1.5 shrink-0">
          {QUICK_PROMPTS.map(p => (
            <button key={p} onClick={() => send(p)}
              className="text-[11px] bg-indigo-50 text-indigo-600 hover:bg-indigo-100 px-2.5 py-1 rounded-full transition-colors">
              {p}
            </button>
          ))}
        </div>
      )}

      {/* Input */}
      <div className="border-t px-3 py-2.5 flex items-end gap-2 shrink-0">
        <textarea
          ref={inputRef}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }}
          placeholder="描述你的需求，例：幫我寫一個適合親子的民宿故事…"
          rows={2}
          className="flex-1 text-sm border rounded-xl px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-indigo-300"
        />
        <button onClick={() => send()} disabled={!input.trim() || loading}
          className="p-2.5 rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-40 transition-colors shrink-0">
          <Send className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}
