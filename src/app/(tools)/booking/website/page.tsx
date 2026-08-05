'use client'
import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import {
  Save, Loader2, ExternalLink, RefreshCw,
  Monitor, Smartphone, Check, Plus, X, Globe, Sparkles,
} from 'lucide-react'
import { TEMPLATES } from '@/lib/booking/templates'
import AiPanel from './AiPanel'

interface FaqItem { q: string; a: string }
interface WebForm {
  slug: string
  template_id: string; theme_color: string
  custom_design: Record<string, unknown> | null
  tagline: string; hero_cta_text: string
  about: string; owner_intro: string; faq: FaqItem[]
  booking_instructions: string; cancellation_policy: string
  contact_note: string; contact_map_embed: string
  social_links: { facebook: string; instagram: string; youtube: string }
  seo_title: string; seo_description: string
}

const DEFAULT: WebForm = {
  slug: '', template_id: 'natural', theme_color: '#2d6a4f', custom_design: null,
  tagline: '', hero_cta_text: '',
  about: '', owner_intro: '', faq: [],
  booking_instructions: '', cancellation_policy: '',
  contact_note: '', contact_map_embed: '',
  social_links: { facebook: '', instagram: '', youtube: '' },
  seo_title: '', seo_description: '',
}

type PageTab = 'home' | 'about' | 'rooms' | 'booking' | 'contact'

const PAGES: { id: PageTab; labelKey: string; path: string }[] = [
  { id: 'home',    labelKey: 'website.pages.home',    path: '' },
  { id: 'about',   labelKey: 'website.pages.about',   path: '/about' },
  { id: 'rooms',   labelKey: 'website.pages.rooms',   path: '/rooms' },
  { id: 'booking', labelKey: 'website.pages.booking', path: '/booking' },
  { id: 'contact', labelKey: 'website.pages.contact', path: '/contact' },
]

export default function WebsiteEditorPage() {
  const t = useTranslations('Booking')
  const [form, setForm]       = useState<WebForm>(DEFAULT)
  const [initial, setInitial] = useState<WebForm | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving]   = useState(false)
  const [saved, setSaved]     = useState(false)
  const [page, setPage]       = useState<PageTab>('home')
  const [device, setDevice]   = useState<'desktop' | 'mobile'>('desktop')
  const [previewKey, setPreviewKey] = useState(0)
  const [mobileView, setMobileView] = useState<'edit' | 'preview'>('edit')
  const [aiOpen, setAiOpen]         = useState(false)

  useEffect(() => {
    fetch('/api/booking/profile').then(r => r.json()).then(d => {
      if (d.profile) {
        const p = d.profile
        const w: WebForm = {
          slug:                  p.slug ?? '',
          template_id:           p.template_id ?? 'natural',
          theme_color:           p.theme_color ?? '#2d6a4f',
          custom_design:         p.custom_design ?? null,
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
      else alert(d.error ?? t('website.saveFailed'))
    } finally { setSaving(false) }
  }

  const dirty    = initial ? JSON.stringify(form) !== JSON.stringify(initial) : false
  const iframeSrc = form.slug
    ? `/book/${form.slug}${PAGES.find(p => p.id === page)?.path ?? ''}?_t=${previewKey}`
    : null

  if (loading) return (
    <div className="h-full flex items-center justify-center text-gray-400 text-sm">
      <Loader2 className="h-4 w-4 animate-spin mr-2" /> {t('common.loading')}
    </div>
  )

  return (
    <div className="h-full flex flex-col bg-gray-50 overflow-hidden">

      {/* ── Top bar ── */}
      <header className="h-12 bg-white border-b flex items-center gap-3 px-4 shrink-0 z-10 shadow-sm">
        <span className="font-semibold text-gray-800 text-sm hidden sm:block">{t('nav.website')}</span>

        {form.slug && (
          <a href={`/book/${form.slug}`} target="_blank" rel="noreferrer"
            className="flex items-center gap-1 text-xs text-indigo-500 hover:underline">
            <ExternalLink className="h-3.5 w-3.5" /> {t('profile.web.openSite')}
          </a>
        )}

        <div className="ml-auto flex items-center gap-2">
          <button onClick={() => setAiOpen(o => !o)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors
              ${aiOpen
                ? 'bg-violet-600 text-white border-violet-600'
                : 'border-violet-200 text-violet-600 hover:bg-violet-50'}`}>
            <Sparkles className="h-3.5 w-3.5" />
            {t('website.aiDesign')}
          </button>
          {/* Desktop device toggle */}
          <div className="hidden md:flex items-center gap-0.5 bg-gray-100 rounded-lg p-0.5">
            <button onClick={() => setDevice('desktop')} title={t('website.desktop')}
              className={`p-1.5 rounded-md transition-colors ${device === 'desktop' ? 'bg-white shadow-sm text-gray-800' : 'text-gray-400 hover:text-gray-600'}`}>
              <Monitor className="h-3.5 w-3.5" />
            </button>
            <button onClick={() => setDevice('mobile')} title={t('website.mobile')}
              className={`p-1.5 rounded-md transition-colors ${device === 'mobile' ? 'bg-white shadow-sm text-gray-800' : 'text-gray-400 hover:text-gray-600'}`}>
              <Smartphone className="h-3.5 w-3.5" />
            </button>
          </div>

          <button onClick={() => setPreviewKey(k => k + 1)} title={t('website.refreshPreview')}
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
            {saving ? t('bookings.form.saving') : saved && !dirty ? t('website.saved') : t('detail.save')}
          </button>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">

        {/* ── Left panel (settings or AI) ── */}
        <aside className={`w-72 shrink-0 border-r flex flex-col overflow-hidden transition-colors
          ${aiOpen ? 'bg-white' : 'bg-white'}
          ${mobileView === 'preview' ? 'hidden md:flex' : 'flex'}`}>

          {/* AI Panel */}
          {aiOpen && (
            <AiPanel
              form={form}
              onApply={updates => {
                Object.entries(updates).forEach(([k, v]) => {
                  if (v !== undefined) set(k as keyof typeof form, v as never)
                })
              }}
              onClose={() => setAiOpen(false)}
            />
          )}

          {/* Settings Panel */}
          {!aiOpen && <>
          {/* Page tabs */}
          <div className="flex border-b overflow-x-auto shrink-0 bg-gray-50">
            {PAGES.map(p => (
              <button key={p.id} onClick={() => setPage(p.id)}
                className={`flex-1 px-2 py-2.5 text-xs font-medium whitespace-nowrap border-b-2 transition-colors min-w-0
                  ${page === p.id
                    ? 'border-indigo-600 text-indigo-600 bg-white'
                    : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
                {t(p.labelKey)}
              </button>
            ))}
          </div>

          {/* Scrollable fields */}
          <div className="flex-1 overflow-y-auto p-4 space-y-5">

            {/* ─── 首頁 ─── */}
            {page === 'home' && <>
              <div>
                <label className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide block mb-1.5">{t('website.siteUrl')}</label>
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
                <label className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide block mb-2">{t('website.visualStyle')}</label>
                {form.template_id === 'custom' && (
                  <div className="mb-2 flex items-center gap-2 rounded-lg border border-violet-200 bg-violet-50 px-3 py-2 text-xs text-violet-700">
                    <Sparkles className="h-3.5 w-3.5 shrink-0" />
                    <span>{t('website.customDesignActive')}</span>
                  </div>
                )}
                <div className="grid grid-cols-2 gap-2">
                  {TEMPLATES.map(tpl => (
                    <button key={tpl.id} type="button"
                      onClick={() => { set('template_id', tpl.id); if (!form.theme_color || form.theme_color === '#4f46e5') set('theme_color', tpl.accent) }}
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
                <label className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide block mb-2">{t('website.themeColor')}</label>
                <div className="flex items-center gap-2.5">
                  <input type="color" value={form.theme_color} onChange={e => set('theme_color', e.target.value)}
                    className="w-9 h-9 rounded-lg border cursor-pointer p-0.5 shrink-0" />
                  <span className="text-sm font-mono text-gray-600 flex-1">{form.theme_color}</span>
                  <button type="button"
                    onClick={() => { const tpl = TEMPLATES.find(x => x.id === form.template_id); if (tpl) set('theme_color', tpl.accent) }}
                    className="text-[11px] text-indigo-500 hover:underline shrink-0">{t('website.reset')}</button>
                </div>
              </div>

              <div>
                <label className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide block mb-1.5">{t('website.tagline')}</label>
                <input value={form.tagline} onChange={e => set('tagline', e.target.value)}
                  placeholder={t('website.taglinePlaceholder')}
                  className="w-full text-sm border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-300" />
              </div>

              <div>
                <label className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide block mb-1.5">{t('website.ctaLabel')}</label>
                <input value={form.hero_cta_text} onChange={e => set('hero_cta_text', e.target.value)}
                  placeholder={t('website.ctaPlaceholder')}
                  className="w-full text-sm border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-300" />
              </div>

              <div className="border-t pt-4 space-y-3">
                <label className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide block">SEO</label>
                <input value={form.seo_title} onChange={e => set('seo_title', e.target.value)}
                  placeholder={t('website.seoTitlePlaceholder')}
                  className="w-full text-sm border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-300" />
                <textarea value={form.seo_description} onChange={e => set('seo_description', e.target.value)}
                  rows={2} placeholder={t('website.seoDescPlaceholder')}
                  className="w-full text-sm border rounded-lg px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-indigo-300" />
              </div>
            </>}

            {/* ─── 關於 ─── */}
            {page === 'about' && <>
              <div>
                <label className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide block mb-1.5">{t('website.story')}</label>
                <textarea value={form.about} onChange={e => set('about', e.target.value)}
                  rows={6} placeholder={t('website.storyPlaceholder')}
                  className="w-full text-sm border rounded-lg px-3 py-2 resize-y focus:outline-none focus:ring-2 focus:ring-indigo-300" />
              </div>

              <div>
                <label className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide block mb-1.5">{t('website.ownerIntro')}</label>
                <textarea value={form.owner_intro} onChange={e => set('owner_intro', e.target.value)}
                  rows={3} placeholder={t('website.ownerIntroPlaceholder')}
                  className="w-full text-sm border rounded-lg px-3 py-2 resize-y focus:outline-none focus:ring-2 focus:ring-indigo-300" />
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide">{t('website.faq')}</label>
                  <button onClick={addFaq}
                    className="flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-700">
                    <Plus className="h-3 w-3" /> {t('bookings.add')}
                  </button>
                </div>
                {form.faq.length === 0 && (
                  <p className="text-xs text-gray-400 text-center py-5 border border-dashed rounded-xl">{t('website.noFaq')}</p>
                )}
                <div className="space-y-2">
                  {form.faq.map((item, i) => (
                    <div key={i} className="bg-gray-50 rounded-xl p-3 space-y-1.5">
                      <div className="flex items-start gap-1.5">
                        <div className="flex-1 space-y-1.5">
                          <input value={item.q} onChange={e => updateFaq(i, { q: e.target.value })}
                            placeholder={t('website.faqQ')}
                            className="w-full text-sm border rounded-lg px-3 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300" />
                          <textarea value={item.a} onChange={e => updateFaq(i, { a: e.target.value })}
                            rows={2} placeholder={t('website.faqA')}
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
                <p className="text-sm font-semibold text-gray-800">{t('website.roomsTitle')}</p>
                <p className="text-xs text-gray-500 leading-relaxed max-w-[200px]">
                  {t('website.roomsHint')}
                </p>
                <a href="/booking/properties" target="_blank"
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700 transition-colors">
                  {t('website.gotoRooms')} <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            )}

            {/* ─── 訂房 ─── */}
            {page === 'booking' && <>
              <div>
                <label className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide block mb-1.5">{t('website.bookingInstr')}</label>
                <textarea value={form.booking_instructions} onChange={e => set('booking_instructions', e.target.value)}
                  rows={4} placeholder={t('website.bookingInstrPlaceholder')}
                  className="w-full text-sm border rounded-lg px-3 py-2 resize-y focus:outline-none focus:ring-2 focus:ring-indigo-300" />
              </div>
              <div>
                <label className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide block mb-1.5">{t('website.cancelPolicy')}</label>
                <textarea value={form.cancellation_policy} onChange={e => set('cancellation_policy', e.target.value)}
                  rows={4} placeholder={t('website.cancelPolicyPlaceholder')}
                  className="w-full text-sm border rounded-lg px-3 py-2 resize-y focus:outline-none focus:ring-2 focus:ring-indigo-300" />
              </div>
            </>}

            {/* ─── 聯絡 ─── */}
            {page === 'contact' && <>
              <div>
                <label className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide block mb-1.5">{t('website.contactNote')}</label>
                <textarea value={form.contact_note} onChange={e => set('contact_note', e.target.value)}
                  rows={2} placeholder={t('website.contactNotePlaceholder')}
                  className="w-full text-sm border rounded-lg px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-indigo-300" />
              </div>

              <div>
                <label className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide block mb-2">{t('website.socialLinks')}</label>
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
                <label className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide block mb-1.5">{t('website.mapEmbed')}</label>
                <input value={form.contact_map_embed} onChange={e => set('contact_map_embed', e.target.value)}
                  placeholder="https://www.google.com/maps/embed?pb=..."
                  className="w-full text-sm border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-300" />
                <p className="text-[11px] text-gray-400 mt-1">
                  {t('website.mapHint')}
                </p>
              </div>
            </>}
          </div>

          {/* Mobile edit/preview toggle */}
          <div className="md:hidden border-t p-3 flex gap-2 bg-white shrink-0">
            <button onClick={() => setMobileView('edit')}
              className={`flex-1 py-2 rounded-lg text-xs font-medium transition-colors
                ${mobileView === 'edit' ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-600'}`}>
              {t('website.edit')}
            </button>
            <button onClick={() => setMobileView('preview')}
              className={`flex-1 py-2 rounded-lg text-xs font-medium transition-colors
                ${mobileView === 'preview' ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-600'}`}>
              {t('website.preview')}
            </button>
          </div>
          </>}
        </aside>

        {/* ── Right preview ── */}
        <main className={`flex-1 flex flex-col overflow-hidden bg-gray-100
          ${mobileView === 'edit' ? 'hidden md:flex' : 'flex'}`}>
          {!form.slug ? (
            <div className="flex-1 flex items-center justify-center p-8 text-center">
              <div className="space-y-4 w-full max-w-xs">
                <Globe className="h-10 w-10 text-gray-300 mx-auto" />
                <p className="text-sm font-medium text-gray-600">{t('website.setUrlPrompt')}</p>
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
                  {t('website.saveAndPreview')}
                </button>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center py-4 px-4 overflow-auto gap-3">
              {dirty && (
                <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-1.5 shrink-0">
                  {t('website.dirtyHint')}
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
                  title={t('website.previewTitle')}
                />
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  )
}
