'use client'
import { useEffect, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Send, Loader2, X, Sparkles, ChevronDown, ChevronUp, Check, ImagePlus } from 'lucide-react'

interface WebForm {
  slug: string; name?: string; template_id: string; theme_color: string
  custom_design?: Record<string, unknown> | null
  tagline: string; hero_cta_text: string
  about: string; owner_intro: string; faq: { q: string; a: string }[]
  booking_instructions: string; cancellation_policy: string
  contact_note: string; contact_map_embed: string
  social_links: { facebook: string; instagram: string; youtube: string }
  seo_title: string; seo_description: string
}

type Updates = Partial<Omit<WebForm, 'slug' | 'contact_map_embed' | 'social_links'>>

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
  onImagesUploaded?: () => void
}

// 手機原圖常超過 Vercel 4.5MB 請求上限，上傳前先縮到最長邊 1920 並轉 JPEG
function compressImage(file: File): Promise<Blob> {
  return new Promise(resolve => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      const scale = Math.min(1, 1920 / Math.max(img.width, img.height))
      const canvas = document.createElement('canvas')
      canvas.width = Math.round(img.width * scale)
      canvas.height = Math.round(img.height * scale)
      const ctx = canvas.getContext('2d')
      if (!ctx) { URL.revokeObjectURL(url); resolve(file); return }
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
      canvas.toBlob(b => { URL.revokeObjectURL(url); resolve(b ?? file) }, 'image/jpeg', 0.85)
    }
    img.onerror = () => { URL.revokeObjectURL(url); resolve(file) }
    img.src = url
  })
}

export default function AiPanel({ form, onApply, onClose, onImagesUploaded }: Props) {
  const t = useTranslations('Booking')
  const FIELD_LABELS: Record<string, string> = {
    template_id: t('website.ai.fields.template_id'),
    theme_color: t('website.ai.fields.theme_color'),
    custom_design: t('website.ai.fields.custom_design'),
    tagline: t('website.ai.fields.tagline'),
    about: t('website.ai.fields.about'),
    owner_intro: t('website.ai.fields.owner_intro'),
    hero_cta_text: t('website.ai.fields.hero_cta_text'),
    booking_instructions: t('website.ai.fields.booking_instructions'),
    cancellation_policy: t('website.ai.fields.cancellation_policy'),
    contact_note: t('website.ai.fields.contact_note'),
    seo_title: t('website.ai.fields.seo_title'),
    seo_description: t('website.ai.fields.seo_description'),
    faq: t('website.ai.fields.faq'),
  }
  const TEMPLATE_NAMES: Record<string, string> = {
    natural: t('website.ai.templates.natural'), coastal: t('website.ai.templates.coastal'),
    boutique: t('website.ai.templates.boutique'), zen: t('website.ai.templates.zen'),
    custom: t('website.ai.templates.custom'),
  }
  const QUICK_PROMPTS = [0,1,2,3,4,5,6].map(i => t(`website.ai.prompts.${i}`))
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      content: t('website.ai.welcome'),
    },
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [expandedUpdates, setExpandedUpdates] = useState<number[]>([])
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
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
            custom_design: form.custom_design ?? null,
            tagline: form.tagline,
            about: form.about,
            seo_title: form.seo_title,
          },
        }),
      })
      const d = await res.json()
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: d.text ?? t('website.ai.noReply'),
        updates: d.updates ?? undefined,
      }])
      if (d.updates) {
        setExpandedUpdates(prev => [...prev, history.length])
      }
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: t('website.ai.error') }])
    } finally {
      setLoading(false)
      inputRef.current?.focus()
    }
  }

  async function uploadImages(files: FileList | null) {
    const list = Array.from(files ?? []).filter(f => f.type.startsWith('image/'))
    if (!list.length || uploading) return
    setUploading(true)
    try {
      const urls: string[] = []
      for (const f of list) {
        const fd = new FormData()
        fd.append('file', new File([await compressImage(f)], `${Date.now()}.jpg`, { type: 'image/jpeg' }))
        const r = await fetch('/api/booking/photos', { method: 'POST', body: fd })
        const d = await r.json().catch(() => ({}))
        if (!r.ok || !d.url) throw new Error(d.error || 'upload failed')
        urls.push(d.url)
      }
      // 直接寫回官網照片（images），不經過編輯器表單，避免之後按儲存時被舊資料蓋掉；
      // name 一併帶回，因為 profile PUT 的 upsert 預設會把沒給的 name 寫成空字串
      const cur = await fetch('/api/booking/profile').then(r => r.json())
      const p = cur.profile ?? {}
      const res = await fetch('/api/booking/profile', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: p.name ?? '', images: [...((p.images as string[] | null) ?? []), ...urls] }),
      })
      if (!res.ok) throw new Error('save failed')
      setMessages(prev => [...prev, { role: 'assistant', content: t('website.ai.uploaded', { count: urls.length }) }])
      onImagesUploaded?.()
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: t('website.ai.uploadFailed') }])
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ''
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
          <span className="text-sm font-semibold text-gray-800">{t('website.ai.title')}</span>
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
                    {msg.applied ? t('website.ai.applied') : t('website.ai.fieldsCount', { count: Object.keys(msg.updates).length })}
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
                                : key === 'custom_design'
                                  ? <span className="flex items-center gap-1">
                                      {['accent', 'ink', 'sectionBg'].map(c => (
                                        <span key={c} className="inline-block w-3.5 h-3.5 rounded-full border border-gray-200 shrink-0"
                                          style={{ backgroundColor: String((val as Record<string, unknown>)[c] ?? '#fff') }} />
                                      ))}
                                      <span>{t('website.ai.customDesignGenerated')}</span>
                                    </span>
                                  : key === 'faq'
                                    ? t('website.ai.questionsCount', { count: (val as { q: string }[]).length })
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
                          <Check className="h-3.5 w-3.5" /> {t('website.ai.applyBtn')}
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
              <span className="text-sm text-gray-500">{t('website.ai.writing')}</span>
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
        <input ref={fileRef} type="file" accept="image/*" multiple className="hidden"
          onChange={e => uploadImages(e.target.files)} />
        <button onClick={() => fileRef.current?.click()} disabled={uploading}
          title={uploading ? t('website.ai.uploading') : t('website.ai.uploadImage')}
          className="p-2.5 rounded-xl border text-gray-500 hover:text-indigo-600 hover:border-indigo-300 disabled:opacity-40 transition-colors shrink-0">
          {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />}
        </button>
        <textarea
          ref={inputRef}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }}
          placeholder={t('website.ai.inputPlaceholder')}
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
