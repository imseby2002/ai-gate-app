'use client'
import { useEffect, useState } from 'react'
import {
  Save, Loader2, ExternalLink, RefreshCw,
  Monitor, Smartphone, Check, Plus, X, Globe,
} from 'lucide-react'
import { TEMPLATES } from '@/lib/booking/templates'

interface FaqItem { q: string; a: string }
interface WebForm {
  slug: string
  template_id: string; theme_color: string
  tagline: string; hero_cta_text: string
  about: string; owner_intro: string; faq: FaqItem[]
  booking_instructions: string; cancellation_policy: string
  contact_note: string; contact_map_embed: string
  social_links: { facebook: string; instagram: string; youtube: string }
  seo_title: string; seo_description: string
}

const DEFAULT: WebForm = {
  slug: '', template_id: 'natural', theme_color: '#2d6a4f',
  tagline: '', hero_cta_text: '',
  about: '', owner_intro: '', faq: [],
  booking_instructions: '', cancellation_policy: '',
  contact_note: '', contact_map_embed: '',
  social_links: { facebook: '', instagram: '', youtube: '' },
  seo_title: '', seo_description: '',
}

type PageTab = 'home' | 'about' | 'rooms' | 'booking' | 'contact'

const PAGES: { id: PageTab; label: string; path: string }[] = [
  { id: 'home',    label: '首頁', path: '' },
  { id: 'about',   label: '關於', path: '/about' },
  { id: 'rooms',   label: '房型', path: '/rooms' },
  { id: 'booking', label: '訂房', path: '/booking' },
  { id: 'contact', label: '聯絡', path: '/contact' },
]

export default function WebsiteEditorPage() {
  const [form, setForm]       = useState<WebForm>(DEFAULT)
  const [initial, setInitial] = useState<WebForm | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving]   = useState(false)
  const [saved, setSaved]     = useState(false)
  const [page, setPage]       = useState<PageTab>('home')
  const [device, setDevice]   = useState<'desktop' | 'mobile'>('desktop')
  const [previewKey, setPreviewKey] = useState(0)
  const [mobileView, setMobileView] = useState<'edit' | 'preview'>('edit')

  useEffect(() => {
    fetch('/api/booking/profile').then(r => r.json()).then(d => {
      if (d.profile) {
        const p = d.profile
        const w: WebForm = {
          slug:                  p.slug ?? '',
          template_id:           p.template_id ?? 'natural',
          theme_color:           p.theme_color ?? '#2d6a4f',
          tagline:               p.tagline ?? '',
          hero_cta_text:         p.hero_cta_text ?? '',
          about:                 p.about ?? '',
          owner_intro:           p.owner_intro ?? '',
          faq:                   p.faq ?? [],
          booking_instructions:  p.booking_instructions ?? '',
          cancellation_policy:   p.cancellation_policy ?? '',
          contact_note:          p.contact_note ?? '',
          contact_map_embed:     p.contact_map_embed ?? '',
          social_links:          p.social_links ?? { facebook: '', instagram: '', youtube: '' },
          seo_title:             p.seo_title ?? '',
          seo_description:       p.seo_description ?? '',
        }
        setForm(w); setInitial(w)
      }
    }).finally(() => setLoading(false))
  }, [])

  function set<K extends keyof WebForm>(k: K, v: WebForm[K]) {
    setForm(f => ({ ...f, [k]: v })); setSaved(false)
  }
  function setSocial(k: keyof WebForm['social_links'], v: string) {
    setForm(f => ({ ...f, social_links: { ...f.social_links, [k]: v } })); setSaved(false)
  }
  function addFaq() { setForm(f => ({ ...f, faq: [...f.faq, { q: '', a: '' }] })); setSaved(false) }
  function updateFaq(i: number, u: Partial<FaqItem>) {
    setForm(f => ({ ...f, faq: f.faq.map((item, idx) => idx === i ? { ...item, ...u } : item) }))
    setSaved(false)
  }
  function removeFaq(i: number) {
    setForm(f => ({ ...f, faq: f.faq.filter((_, idx) => idx !== i) })); setSaved(false)
  }

  async function save() {
    setSaving(true)
    try {
      const res = await fetch('/api/booking/profile', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const d = await res.json()
      if (d.profile) { setSaved(true); setInitial(form); setPreviewKey(k => k + 1) }
    } finally { setSaving(false) }
  }

  const dirty    = initial ? JSON.stringify(form) !== JSON.stringify(initial) : false
  const iframeSrc = form.slug
    ? `/book/${form.slug}${PAGES.find(p => p.id === page)?.path ?? ''}?_t=${previewKey}`
    : null

  if (loading) return (
    <div className="h-full flex items-center justify-center text-gray-400 text-sm">
      <Loader2 className="h-4 w-4 animate-spin mr-2" /> 載入中…
    </div>
  )

  return (
    <div className="h-full flex flex-col bg-gray-50 overflow-hidden">

      {/* ── Top bar ── */}
      <header className="h-12 bg-white border-b flex items-center gap-3 px-4 shrink-0 z-10 shadow-sm">
        <span className="font-semibold text-gray-800 text-sm hidden sm:block">官網編輯器</span>

        {form.slug && (
          <a href={`/book/${form.slug}`} target="_blank" rel="noreferrer"
            className="flex items-center gap-1 text-xs text-indigo-500 hover:underline">
            <ExternalLink className="h-3.5 w-3.5" /> 開啟官網
          </a>
        )}

        <div className="ml-auto flex items-center gap-2">
          {/* Desktop device toggle */}
          <div className="hidden md:flex items-center gap-0.5 bg-gray-100 rounded-lg p-0.5">
            <button onClick={() => setDevice('desktop')} title="電腦版"
              className={`p-1.5 rounded-md transition-colors ${device === 'desktop' ? 'bg-white shadow-sm text-gray-800' : 'text-gray-400 hover:text-gray-600'}`}>
              <Monitor className="h-3.5 w-3.5" />
            </button>
            <button onClick={() => setDevice('mobile')} title="手機版"
              className={`p-1.5 rounded-md transition-colors ${device === 'mobile' ? 'bg-white shadow-sm text-gray-800' : 'text-gray-400 hover:text-gray-600'}`}>
              <Smartphone className="h-3.5 w-3.5" />
            </button>
          </div>

          <button onClick={() => setPreviewKey(k => k + 1)} title="重新整理預覽"
            className="hidden md:flex p-1.5 rounded-lg border bg-white text-gray-500 hover:text-gray-700 items-center justify-center">
            <RefreshCw className="h-3.5 w-3.5" />
          </button>

          <button onClick={save} disabled={saving}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700 disabled:opacity-50 transition-colors">
            {saving
              ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
              : saved && !dirty
                ? <Check className="h-3.5 w-3.5" />
                : <Save className="h-3.5 w-3.5" />}
            {saving ? '儲存中…' : saved && !dirty ? '已儲存' : '儲存'}
          </button>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">

        {/* ── Left settings panel ── */}
        <aside className={`w-72 shrink-0 bg-white border-r flex flex-col overflow-hidden
          ${mobileView === 'preview' ? 'hidden md:flex' : 'flex'}`}>

          {/* Page tabs */}
          <div className="flex border-b overflow-x-auto shrink-0 bg-gray-50">
            {PAGES.map(p => (
              <button key={p.id} onClick={() => setPage(p.id)}
                className={`flex-1 px-2 py-2.5 text-xs font-medium whitespace-nowrap border-b-2 transition-colors min-w-0
                  ${page === p.id
                    ? 'border-indigo-600 text-indigo-600 bg-white'
                    : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
                {p.label}
              </button>
            ))}
          </div>

          {/* Scrollable fields */}
          <div className="flex-1 overflow-y-auto p-4 space-y-5">

            {/* ─── 首頁 ─── */}
            {page === 'home' && <>
              <div>
                <label className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide block mb-1.5">官網網址</label>
                <div className="flex items-center gap-1.5 bg-gray-50 border rounded-lg px-3 py-2 text-sm">
                  <span className="text-gray-400 shrink-0 text-xs">/book/</span>
                  <input
                    value={form.slug}
                    onChange={e => set('slug', e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                    placeholder="my-bnb-name"
                    className="flex-1 bg-transparent focus:outline-none text-gray-800 text-sm"
                  />
                  {form.slug && (
                    <a href={`/book/${form.slug}`} target="_blank" rel="noreferrer" className="shrink-0">
                      <ExternalLink className="h-3.5 w-3.5 text-indigo-400 hover:text-indigo-600" />
                    </a>
                  )}
                </div>
              </div>

              <div>
                <label className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide block mb-2">視覺風格</label>
                <div className="grid grid-cols-2 gap-2">
                  {TEMPLATES.map(tpl => (
                    <button key={tpl.id} type="button"
                      onClick={() => { set('template_id', tpl.id); if (!form.theme_color || form.theme_color === '#4f46e5') set('theme_color', tpl.defaultAccent) }}
                      className={`relative rounded-xl overflow-hidden border-2 transition-all text-left
                        ${form.template_id === tpl.id ? 'border-indigo-500 ring-2 ring-indigo-100' : 'border-gray-200 hover:border-gray-300'}`}>
                      <div className={`h-14 bg-gradient-to-br ${tpl.previewBg}`} />
                      <div className="px-2 py-1.5 flex items-center justify-between">
                        <span className="text-[11px] font-semibold text-gray-800">{tpl.name}</span>
                        {form.template_id === tpl.id && <Check className="h-3 w-3 text-indigo-600 shrink-0" />}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide block mb-2">主題色</label>
                <div className="flex items-center gap-2.5">
                  <input type="color" value={form.theme_color} onChange={e => set('theme_color', e.target.value)}
                    className="w-9 h-9 rounded-lg border cursor-pointer p-0.5 shrink-0" />
                  <span className="text-sm font-mono text-gray-600 flex-1">{form.theme_color}</span>
                  <button type="button"
                    onClick={() => { const t = TEMPLATES.find(t => t.id === form.template_id); if (t) set('theme_color', t.defaultAccent) }}
                    className="text-[11px] text-indigo-500 hover:underline shrink-0">重設</button>
                </div>
              </div>

              <div>
                <label className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide block mb-1.5">副標語</label>
                <input value={form.tagline} onChange={e => set('tagline', e.target.value)}
                  placeholder="山中靜謐，回歸自然的好所在"
                  className="w-full text-sm border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-300" />
              </div>

              <div>
                <label className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide block mb-1.5">立即訂房 按鈕文字</label>
                <input value={form.hero_cta_text} onChange={e => set('hero_cta_text', e.target.value)}
                  placeholder="立即訂房（預設）"
                  className="w-full text-sm border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-300" />
              </div>

              <div className="border-t pt-4 space-y-3">
                <label className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide block">SEO</label>
                <input value={form.seo_title} onChange={e => set('seo_title', e.target.value)}
                  placeholder="Google 搜尋標題（預設用民宿名稱）"
                  className="w-full text-sm border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-300" />
                <textarea value={form.seo_description} onChange={e => set('seo_description', e.target.value)}
                  rows={2} placeholder="搜尋摘要，建議 120 字以內"
                  className="w-full text-sm border rounded-lg px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-indigo-300" />
              </div>
            </>}

            {/* ─── 關於 ─── */}
            {page === 'about' && <>
              <div>
                <label className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide block mb-1.5">民宿故事</label>
                <textarea value={form.about} onChange={e => set('about', e.target.value)}
                  rows={6} placeholder="詳細描述民宿故事、環境特色…"
                  className="w-full text-sm border rounded-lg px-3 py-2 resize-y focus:outline-none focus:ring-2 focus:ring-indigo-300" />
              </div>

              <div>
                <label className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide block mb-1.5">主人介紹</label>
                <textarea value={form.owner_intro} onChange={e => set('owner_intro', e.target.value)}
                  rows={3} placeholder="簡短介紹業者，讓旅客感受溫度…"
                  className="w-full text-sm border rounded-lg px-3 py-2 resize-y focus:outline-none focus:ring-2 focus:ring-indigo-300" />
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide">常見問題 FAQ</label>
                  <button onClick={addFaq}
                    className="flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-700">
                    <Plus className="h-3 w-3" /> 新增
                  </button>
                </div>
                {form.faq.length === 0 && (
                  <p className="text-xs text-gray-400 text-center py-5 border border-dashed rounded-xl">尚無 FAQ</p>
                )}
                <div className="space-y-2">
                  {form.faq.map((item, i) => (
                    <div key={i} className="bg-gray-50 rounded-xl p-3 space-y-1.5">
                      <div className="flex items-start gap-1.5">
                        <div className="flex-1 space-y-1.5">
                          <input value={item.q} onChange={e => updateFaq(i, { q: e.target.value })}
                            placeholder="問題"
                            className="w-full text-sm border rounded-lg px-3 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300" />
                          <textarea value={item.a} onChange={e => updateFaq(i, { a: e.target.value })}
                            rows={2} placeholder="回答"
                            className="w-full text-sm border rounded-lg px-3 py-1.5 bg-white resize-none focus:outline-none focus:ring-2 focus:ring-indigo-300" />
                        </div>
                        <button onClick={() => removeFaq(i)}
                          className="p-1 text-gray-400 hover:text-rose-500 mt-0.5">
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>}

            {/* ─── 房型 ─── */}
            {page === 'rooms' && (
              <div className="flex flex-col items-center text-center py-8 space-y-3">
                <div className="w-14 h-14 bg-indigo-50 rounded-2xl flex items-center justify-center">
                  <span className="text-3xl">🛏</span>
                </div>
                <p className="text-sm font-semibold text-gray-800">房型資料</p>
                <p className="text-xs text-gray-500 leading-relaxed max-w-[200px]">
                  每間房型的照片、描述、定價在<br/>「房型管理」維護，自動顯示於官網
                </p>
                <a href="/booking/properties" target="_blank"
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700 transition-colors">
                  前往房型管理 <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            )}

            {/* ─── 訂房 ─── */}
            {page === 'booking' && <>
              <div>
                <label className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide block mb-1.5">訂房說明</label>
                <textarea value={form.booking_instructions} onChange={e => set('booking_instructions', e.target.value)}
                  rows={4} placeholder="請填寫正確聯絡資料，業者確認後將以 Email 通知…"
                  className="w-full text-sm border rounded-lg px-3 py-2 resize-y focus:outline-none focus:ring-2 focus:ring-indigo-300" />
              </div>
              <div>
                <label className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide block mb-1.5">取消政策</label>
                <textarea value={form.cancellation_policy} onChange={e => set('cancellation_policy', e.target.value)}
                  rows={4} placeholder="入住 48 小時前可免費取消，逾時收取首晚費用。"
                  className="w-full text-sm border rounded-lg px-3 py-2 resize-y focus:outline-none focus:ring-2 focus:ring-indigo-300" />
              </div>
            </>}

            {/* ─── 聯絡 ─── */}
            {page === 'contact' && <>
              <div>
                <label className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide block mb-1.5">聯絡說明</label>
                <textarea value={form.contact_note} onChange={e => set('contact_note', e.target.value)}
                  rows={2} placeholder="LINE 為主要聯絡管道，通常在 1 小時內回覆。"
                  className="w-full text-sm border rounded-lg px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-indigo-300" />
              </div>

              <div>
                <label className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide block mb-2">社群連結</label>
                <div className="space-y-2">
                  {(['facebook', 'instagram', 'youtube'] as const).map(k => (
                    <div key={k} className="flex items-center gap-2">
                      <span className="text-xs text-gray-500 w-16 shrink-0 capitalize">{k}</span>
                      <input value={form.social_links[k]} onChange={e => setSocial(k, e.target.value)}
                        placeholder={`https://www.${k}.com/...`}
                        className="flex-1 text-sm border rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-300" />
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide block mb-1.5">Google Maps 嵌入網址</label>
                <input value={form.contact_map_embed} onChange={e => set('contact_map_embed', e.target.value)}
                  placeholder="https://www.google.com/maps/embed?pb=..."
                  className="w-full text-sm border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-300" />
                <p className="text-[11px] text-gray-400 mt-1">
                  Google Maps → 分享 → 嵌入地圖 → 複製 src=&quot;&quot; 內的網址
                </p>
              </div>
            </>}
          </div>

          {/* Mobile edit/preview toggle */}
          <div className="md:hidden border-t p-3 flex gap-2 bg-white shrink-0">
            <button onClick={() => setMobileView('edit')}
              className={`flex-1 py-2 rounded-lg text-xs font-medium transition-colors
                ${mobileView === 'edit' ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-600'}`}>
              編輯
            </button>
            <button onClick={() => setMobileView('preview')}
              className={`flex-1 py-2 rounded-lg text-xs font-medium transition-colors
                ${mobileView === 'preview' ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-600'}`}>
              預覽
            </button>
          </div>
        </aside>

        {/* ── Right preview ── */}
        <main className={`flex-1 flex flex-col overflow-hidden bg-gray-100
          ${mobileView === 'edit' ? 'hidden md:flex' : 'flex'}`}>
          {!form.slug ? (
            <div className="flex-1 flex items-center justify-center p-8 text-center">
              <div className="space-y-4 w-full max-w-xs">
                <Globe className="h-10 w-10 text-gray-300 mx-auto" />
                <p className="text-sm font-medium text-gray-600">設定網址後即可預覽官網</p>
                <div className="flex items-center gap-1.5 bg-white border rounded-xl px-3 py-2 text-sm text-gray-400">
                  <span className="shrink-0 text-gray-300">/book/</span>
                  <input
                    value={form.slug}
                    onChange={e => set('slug', e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                    placeholder="my-bnb"
                    className="flex-1 focus:outline-none text-gray-800 bg-transparent"
                  />
                </div>
                <button onClick={save} disabled={saving || !form.slug}
                  className="w-full py-2 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 disabled:opacity-40 transition-colors flex items-center justify-center gap-1.5">
                  {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                  儲存並預覽
                </button>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center py-4 px-4 overflow-auto gap-3">
              {dirty && (
                <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-1.5 shrink-0">
                  ⚠ 有未儲存的變更，儲存後預覽自動更新
                </p>
              )}
              <div
                className={`bg-white rounded-2xl overflow-hidden shadow-lg border transition-all duration-300 flex-1 min-h-0
                  ${device === 'mobile' ? 'w-[390px] shrink-0' : 'w-full max-w-5xl'}`}
                style={device === 'mobile' ? { height: '780px' } : { height: '100%', minHeight: '400px' }}>
                <iframe
                  key={previewKey}
                  src={iframeSrc ?? ''}
                  className="w-full h-full border-0"
                  title="官網預覽"
                />
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  )
}
