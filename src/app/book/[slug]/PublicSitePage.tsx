'use client'
import { useState, useEffect, useRef } from 'react'
import {
  MapPin, Phone, Mail, Users, CheckCircle, Tag, BedDouble,
  ChevronRight, ChevronDown, ChevronUp, Clock, Coffee,
  Globe, MessageCircle, Menu, X,
} from 'lucide-react'

interface FaqItem { q: string; a: string }
interface SocialLinks { facebook?: string; instagram?: string; youtube?: string }
interface BnbProfile {
  name: string
  tagline?: string | null
  description?: string | null
  about?: string | null
  address?: string | null
  city?: string | null
  phone?: string | null
  email?: string | null
  website?: string | null
  line_id?: string | null
  check_in_time?: string | null
  check_out_time?: string | null
  min_nights?: number | null
  breakfast?: { type: string; price_per_person: number; start_time: string; end_time: string; description?: string } | null
  images?: string[] | null
  amenities?: string[] | null
  house_rules?: string | null
  social_links?: SocialLinks | null
  faq?: FaqItem[] | null
  theme_color?: string | null
}
interface Property {
  id: string; name: string; description?: string | null; room_count: number
  base_price?: number | null; extra_guest_fee?: number | null; max_guests?: number | null
  amenities?: string[] | null; images?: string[] | null
}

const EMPTY_FORM = {
  guest_name: '', guest_email: '', guest_phone: '',
  num_guests: 1, check_in: '', check_out: '', notes: '', promo_code: '',
}

function nights(ci: string, co: string) {
  if (!ci || !co) return 0
  return Math.max(0, Math.round((new Date(co).getTime() - new Date(ci).getTime()) / 86400000))
}
function fmt(n: number) { return n.toLocaleString('zh-TW') }

const AMENITY_EMOJI: Record<string, string> = {
  'WiFi': '📶', 'Wi-Fi': '📶', 'Wifi': '📶',
  '停車場': '🅿️', '停車': '🅿️',
  '冷氣': '❄️', '空調': '❄️',
  '浴缸': '🛁', '泡澡': '🛁',
  '廚房': '🍳', '廚具': '🍳',
  '早餐': '☕', '含早': '☕',
  '游泳池': '🏊', '泳池': '🏊',
  '健身房': '💪',
  '烤肉': '🔥', '烤肉區': '🔥',
  '腳踏車': '🚲', '自行車': '🚲',
  '寵物': '🐾', '可帶寵物': '🐾',
  '嬰兒床': '👶',
  '洗衣機': '👕',
  '電視': '📺',
  '山景': '⛰️', '海景': '🌊', '湖景': '🏞️',
}

function scrollTo(id: string, offset = 64) {
  const el = document.getElementById(id)
  if (!el) return
  const top = el.getBoundingClientRect().top + window.scrollY - offset
  window.scrollTo({ top, behavior: 'smooth' })
}

export default function PublicSitePage({
  profile, properties, slug,
}: {
  profile: BnbProfile
  properties: Property[]
  slug: string
}) {
  const accent = profile.theme_color || '#4f46e5'
  const accentStyle = { backgroundColor: accent }
  const accentTextStyle = { color: accent }
  const accentBorderStyle = { borderColor: accent }

  const faq = profile.faq ?? []
  const amenities = (profile.amenities as string[] | null) ?? []
  const images = (profile.images as string[] | null) ?? []
  const socialLinks = profile.social_links ?? {}

  const hasAbout = !!(profile.about || profile.description)
  const hasFacilities = amenities.length > 0
  const hasFaq = faq.length > 0
  const todayStr = new Date().toISOString().slice(0, 10)

  // Booking state
  type Step = 'browse' | 'form' | 'done'
  const [step, setStep] = useState<Step>('browse')
  const [selectedProp, setSelectedProp] = useState<Property | null>(null)
  const [form, setForm] = useState({ ...EMPTY_FORM })
  const [promoValid, setPromoValid] = useState<{ discount: number; name: string } | null>(null)
  const [promoError, setPromoError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')
  const [unavailable, setUnavailable] = useState<Set<string>>(new Set())
  const [serverQuote, setServerQuote] = useState<{ total: number; currency: string; nights: number; extraGuestFee: number } | null>(null)
  const [confirmation, setConfirmation] = useState<
    { code: string; total: number | null; roomName: string; checkIn: string; checkOut: string; guests: number } | null
  >(null)
  const [openFaq, setOpenFaq] = useState<number | null>(null)
  const [mobileNavOpen, setMobileNavOpen] = useState(false)

  useEffect(() => {
    if (!selectedProp) { setUnavailable(new Set()); return }
    fetch(`/api/book/${slug}/availability?property_id=${selectedProp.id}`)
      .then(r => r.json())
      .then(d => setUnavailable(new Set<string>(d.unavailable ?? [])))
      .catch(() => setUnavailable(new Set()))
  }, [selectedProp, slug])

  useEffect(() => {
    const ci = form.check_in, co = form.check_out
    if (!selectedProp || !ci || !co || new Date(co) <= new Date(ci)) { setServerQuote(null); return }
    let cancelled = false
    fetch(`/api/book/${slug}/quote?property_id=${selectedProp.id}&check_in=${ci}&check_out=${co}&num_guests=${form.num_guests}`)
      .then(r => r.json())
      .then(d => { if (!cancelled) setServerQuote(d.quote ?? null) })
      .catch(() => { if (!cancelled) setServerQuote(null) })
    return () => { cancelled = true }
  }, [selectedProp, form.check_in, form.check_out, form.num_guests, slug])

  function rangeConflict(ci: string, co: string): boolean {
    if (!ci || !co) return false
    const start = new Date(`${ci}T00:00:00Z`).getTime()
    const end = new Date(`${co}T00:00:00Z`).getTime()
    if (end <= start) return false
    for (let t = start; t < end; t += 86400000) {
      if (unavailable.has(new Date(t).toISOString().slice(0, 10))) return true
    }
    return false
  }

  const n = nights(form.check_in, form.check_out)
  const basePrice = serverQuote ? serverQuote.total
    : (selectedProp?.base_price ? selectedProp.base_price * n + Math.max(0, form.num_guests - (selectedProp.max_guests ?? 2)) * (selectedProp.extra_guest_fee ?? 0) * n : null)
  const finalPrice = basePrice !== null ? Math.max(0, basePrice - (promoValid?.discount ?? 0)) : null
  const datesInvalid = !!(form.check_in && form.check_out && new Date(form.check_out) <= new Date(form.check_in))
  const dateConflict = rangeConflict(form.check_in, form.check_out)
  const dateBlocked = datesInvalid || dateConflict
  const overCapacity = !!(selectedProp?.max_guests && form.num_guests > selectedProp.max_guests && !selectedProp.extra_guest_fee)

  async function checkPromo() {
    if (!form.promo_code) return
    setPromoError(''); setPromoValid(null)
    const res = await fetch(`/api/book/${slug}/validate-promo`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: form.promo_code, num_nights: n, total_price: basePrice ?? 0 }),
    })
    const d = await res.json()
    if (d.valid) setPromoValid({ discount: d.discount, name: d.name })
    else setPromoError(d.error ?? '無效優惠碼')
  }

  async function submit() {
    if (!form.guest_name || !form.guest_email || !form.check_in || !form.check_out) return
    if (dateBlocked) return
    setSubmitError(''); setSubmitting(true)
    try {
      const res = await fetch(`/api/book/${slug}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form, property_id: selectedProp?.id ?? null,
          promo_code: promoValid ? form.promo_code : null,
        }),
      })
      const d = await res.json()
      if (!res.ok) {
        if (res.status === 409 && selectedProp) {
          fetch(`/api/book/${slug}/availability?property_id=${selectedProp.id}`)
            .then(r => r.json()).then(a => setUnavailable(new Set<string>(a.unavailable ?? []))).catch(() => {})
        }
        setSubmitError(d.error ?? '訂房失敗，請稍後再試'); return
      }
      setConfirmation({
        code: d.booking.confirmation_code, total: d.booking.total_price,
        roomName: selectedProp?.name ?? '不指定房型',
        checkIn: form.check_in, checkOut: form.check_out, guests: form.num_guests,
      })
      setStep('done')
    } catch { setSubmitError('網路錯誤，請稍後再試') }
    finally { setSubmitting(false) }
  }

  function selectRoomAndBook(prop: Property) {
    setSelectedProp(prop)
    setStep('form')
    setTimeout(() => scrollTo('booking'), 50)
  }

  const navLinks = [
    { id: 'top', label: '首頁', always: true },
    { id: 'about', label: '關於', always: false, show: hasAbout },
    { id: 'rooms', label: '房型', always: properties.length > 0 },
    { id: 'facilities', label: '設施', always: false, show: hasFacilities },
    { id: 'faq', label: '常見問題', always: false, show: hasFaq },
    { id: 'contact', label: '聯絡', always: true },
  ].filter(l => l.always || l.show)

  return (
    <div className="min-h-screen bg-white">
      {/* ── Sticky Nav ── */}
      <nav className="sticky top-0 z-50 bg-white/95 backdrop-blur border-b shadow-sm">
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between gap-4">
          <button onClick={() => scrollTo('top')} className="font-bold text-gray-900 text-sm truncate max-w-[140px] sm:max-w-none">
            {profile.name}
          </button>

          {/* Desktop nav */}
          <div className="hidden sm:flex items-center gap-1">
            {navLinks.map(l => (
              <button key={l.id} onClick={() => scrollTo(l.id)}
                className="px-3 py-1.5 rounded-lg text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 transition-colors">
                {l.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <button onClick={() => { setStep('browse'); scrollTo('booking') }}
              className="px-4 py-2 rounded-lg text-sm font-semibold text-white transition-opacity hover:opacity-90"
              style={accentStyle}>
              立即訂房
            </button>
            <button onClick={() => setMobileNavOpen(v => !v)}
              className="sm:hidden p-2 rounded-lg text-gray-500 hover:bg-gray-100">
              {mobileNavOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>

        {/* Mobile nav dropdown */}
        {mobileNavOpen && (
          <div className="sm:hidden border-t bg-white px-4 py-2 flex flex-wrap gap-1">
            {navLinks.map(l => (
              <button key={l.id} onClick={() => { scrollTo(l.id); setMobileNavOpen(false) }}
                className="px-3 py-1.5 rounded-lg text-sm text-gray-600 hover:bg-gray-100">
                {l.label}
              </button>
            ))}
          </div>
        )}
      </nav>

      {/* ── Hero ── */}
      <section id="top">
        {images.length > 0 && (
          <div className="w-full aspect-[16/7] overflow-hidden">
            <img src={images[0]} alt={profile.name} className="w-full h-full object-cover" />
          </div>
        )}
        <div className="max-w-5xl mx-auto px-4 py-8 sm:py-12">
          <h1 className="text-3xl sm:text-4xl font-bold text-gray-900">{profile.name}</h1>
          {profile.tagline && (
            <p className="mt-2 text-lg text-gray-500">{profile.tagline}</p>
          )}
          {profile.address && (
            <div className="flex items-center gap-1.5 text-sm text-gray-500 mt-3">
              <MapPin className="h-4 w-4 shrink-0" style={accentTextStyle} />
              {profile.city ? `${profile.city} · ` : ''}{profile.address}
            </div>
          )}

          {/* Quick badges */}
          <div className="flex flex-wrap gap-2 mt-4">
            {profile.check_in_time && (
              <span className="inline-flex items-center gap-1 text-xs bg-gray-100 text-gray-600 px-2.5 py-1 rounded-full">
                <Clock className="h-3 w-3" />入住 {profile.check_in_time} 後
              </span>
            )}
            {profile.check_out_time && (
              <span className="inline-flex items-center gap-1 text-xs bg-gray-100 text-gray-600 px-2.5 py-1 rounded-full">
                <Clock className="h-3 w-3" />退房 {profile.check_out_time} 前
              </span>
            )}
            {profile.breakfast?.type === 'included' && (
              <span className="inline-flex items-center gap-1 text-xs bg-amber-50 text-amber-700 px-2.5 py-1 rounded-full">
                <Coffee className="h-3 w-3" />含早餐
              </span>
            )}
            {profile.min_nights && profile.min_nights > 1 && (
              <span className="inline-flex items-center gap-1 text-xs bg-gray-100 text-gray-600 px-2.5 py-1 rounded-full">
                最少 {profile.min_nights} 晚
              </span>
            )}
          </div>

          {/* Hero CTAs */}
          <div className="flex flex-wrap gap-3 mt-6">
            <button onClick={() => { setStep('browse'); scrollTo('booking') }}
              className="px-6 py-2.5 rounded-xl text-sm font-bold text-white hover:opacity-90 transition-opacity"
              style={accentStyle}>
              立即訂房
            </button>
            {properties.length > 0 && (
              <button onClick={() => scrollTo('rooms')}
                className="px-6 py-2.5 rounded-xl text-sm font-semibold border-2 text-gray-700 hover:bg-gray-50 transition-colors"
                style={accentBorderStyle}>
                查看房型
              </button>
            )}
          </div>
        </div>
      </section>

      {/* ── About ── */}
      {hasAbout && (
        <section id="about" className="bg-gray-50 py-12">
          <div className="max-w-5xl mx-auto px-4">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">關於我們</h2>
            {(profile.about || profile.description) && (
              <p className="text-gray-600 leading-relaxed whitespace-pre-wrap max-w-2xl">
                {profile.about || profile.description}
              </p>
            )}

            {/* Gallery strip (additional images) */}
            {images.length > 1 && (
              <div className="mt-6 grid grid-cols-2 sm:grid-cols-4 gap-2">
                {images.slice(1, 5).map((src, i) => (
                  <div key={i} className="aspect-square rounded-xl overflow-hidden">
                    <img src={src} alt="" className="w-full h-full object-cover hover:scale-105 transition-transform duration-300" />
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      )}

      {/* ── Rooms ── */}
      {properties.length > 0 && (
        <section id="rooms" className="py-12">
          <div className="max-w-5xl mx-auto px-4">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">房型介紹</h2>
            <div className="grid sm:grid-cols-2 gap-5">
              {properties.map(prop => (
                <div key={prop.id} className="rounded-2xl border overflow-hidden hover:shadow-md transition-shadow">
                  {prop.images && (prop.images as string[]).length > 0 && (
                    <div className="aspect-[16/9] overflow-hidden">
                      <img src={(prop.images as string[])[0]} alt={prop.name} className="w-full h-full object-cover hover:scale-105 transition-transform duration-300" />
                    </div>
                  )}
                  <div className="p-4 space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h3 className="font-semibold text-gray-900">{prop.name}</h3>
                        {prop.description && <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{prop.description}</p>}
                      </div>
                      {prop.base_price && (
                        <div className="text-right shrink-0">
                          <div className="font-bold" style={accentTextStyle}>NT$ {fmt(prop.base_price)}</div>
                          <div className="text-xs text-gray-400">/ 晚</div>
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-xs text-gray-500">
                      <span className="flex items-center gap-1"><Users className="h-3.5 w-3.5" />最多 {prop.max_guests ?? 2} 人</span>
                      {prop.extra_guest_fee && prop.extra_guest_fee > 0 && (
                        <span>超額加收 NT$ {fmt(prop.extra_guest_fee)} / 人晚</span>
                      )}
                    </div>
                    {prop.amenities && (prop.amenities as string[]).length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {(prop.amenities as string[]).slice(0, 6).map(a => (
                          <span key={a} className="text-[11px] bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{a}</span>
                        ))}
                      </div>
                    )}
                    <button onClick={() => selectRoomAndBook(prop)}
                      className="w-full py-2.5 rounded-xl text-white text-sm font-semibold flex items-center justify-center gap-1.5 hover:opacity-90 transition-opacity"
                      style={accentStyle}>
                      選擇訂房 <ChevronRight className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ── Facilities ── */}
      {hasFacilities && (
        <section id="facilities" className="bg-gray-50 py-12">
          <div className="max-w-5xl mx-auto px-4">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">設施與服務</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {amenities.map(a => (
                <div key={a} className="flex items-center gap-2.5 bg-white rounded-xl border px-4 py-3 text-sm text-gray-700">
                  <span className="text-base">{AMENITY_EMOJI[a] ?? '✓'}</span>
                  <span>{a}</span>
                </div>
              ))}
            </div>

            {/* House rules */}
            {profile.house_rules && (
              <div className="mt-8">
                <h3 className="font-semibold text-gray-900 mb-3">住宿規則</h3>
                <div className="bg-white rounded-xl border p-4 text-sm text-gray-600 whitespace-pre-wrap leading-relaxed">
                  {profile.house_rules}
                </div>
              </div>
            )}
          </div>
        </section>
      )}

      {/* ── FAQ ── */}
      {hasFaq && (
        <section id="faq" className="py-12">
          <div className="max-w-3xl mx-auto px-4">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">常見問題</h2>
            <div className="space-y-2">
              {faq.map((item, i) => (
                <div key={i} className="border rounded-xl overflow-hidden">
                  <button onClick={() => setOpenFaq(openFaq === i ? null : i)}
                    className="w-full flex items-center justify-between px-4 py-4 text-left hover:bg-gray-50 transition-colors">
                    <span className="font-medium text-gray-900 text-sm">{item.q}</span>
                    {openFaq === i ? <ChevronUp className="h-4 w-4 text-gray-400 shrink-0" /> : <ChevronDown className="h-4 w-4 text-gray-400 shrink-0" />}
                  </button>
                  {openFaq === i && (
                    <div className="px-4 pb-4 text-sm text-gray-600 leading-relaxed border-t pt-3 whitespace-pre-wrap">
                      {item.a}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ── Contact ── */}
      <section id="contact" className={hasFacilities || hasFaq ? 'bg-gray-50 py-12' : 'py-12'}>
        <div className="max-w-5xl mx-auto px-4">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">聯絡我們</h2>
          <div className="grid sm:grid-cols-2 gap-4">
            {[
              profile.phone    && { icon: <Phone className="h-4 w-4" />, label: '電話', value: profile.phone, href: `tel:${profile.phone}` },
              profile.email    && { icon: <Mail className="h-4 w-4" />, label: 'Email', value: profile.email, href: `mailto:${profile.email}` },
              profile.line_id  && { icon: <MessageCircle className="h-4 w-4" />, label: 'LINE', value: profile.line_id, href: `https://line.me/ti/p/~${profile.line_id}` },
              profile.website  && { icon: <Globe className="h-4 w-4" />, label: '官網', value: profile.website, href: profile.website },
              profile.address  && { icon: <MapPin className="h-4 w-4" />, label: '地址', value: `${profile.city || ''}${profile.address}`, href: `https://maps.google.com/?q=${encodeURIComponent(`${profile.city || ''}${profile.address}`)}` },
            ].filter(Boolean).map((item, i) => {
              if (!item) return null
              return (
                <a key={i} href={item.href} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-3 bg-white rounded-xl border p-4 hover:border-indigo-300 hover:bg-indigo-50/30 transition-colors group">
                  <span className="text-gray-400 group-hover:text-indigo-500 transition-colors">{item.icon}</span>
                  <div>
                    <div className="text-[11px] text-gray-400">{item.label}</div>
                    <div className="text-sm text-gray-800 font-medium">{item.value}</div>
                  </div>
                </a>
              )
            })}
          </div>

          {/* Social links */}
          {(socialLinks.facebook || socialLinks.instagram || socialLinks.youtube) && (
            <div className="flex gap-2 mt-4">
              {socialLinks.facebook && (
                <a href={socialLinks.facebook} target="_blank" rel="noopener noreferrer"
                  className="px-4 py-2 rounded-lg border text-xs text-gray-600 hover:bg-gray-100 transition-colors">
                  Facebook
                </a>
              )}
              {socialLinks.instagram && (
                <a href={socialLinks.instagram} target="_blank" rel="noopener noreferrer"
                  className="px-4 py-2 rounded-lg border text-xs text-gray-600 hover:bg-gray-100 transition-colors">
                  Instagram
                </a>
              )}
              {socialLinks.youtube && (
                <a href={socialLinks.youtube} target="_blank" rel="noopener noreferrer"
                  className="px-4 py-2 rounded-lg border text-xs text-gray-600 hover:bg-gray-100 transition-colors">
                  YouTube
                </a>
              )}
            </div>
          )}
        </div>
      </section>

      {/* ── Booking ── */}
      <section id="booking" className="py-12 border-t">
        <div className="max-w-2xl mx-auto px-4">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">線上訂房</h2>

          {step === 'done' && confirmation ? (
            <div className="bg-white rounded-2xl border p-8 text-center space-y-4">
              <CheckCircle className="h-14 w-14 text-emerald-500 mx-auto" />
              <h3 className="text-xl font-bold text-gray-900">訂房申請已送出！</h3>
              <p className="text-sm text-gray-500">確認碼：<span className="font-mono font-bold text-gray-900 text-base">{confirmation.code}</span></p>
              <div className="text-left text-sm bg-gray-50 rounded-xl p-4 max-w-sm mx-auto space-y-1.5">
                <div className="flex justify-between"><span className="text-gray-500">房型</span><span className="text-gray-900 font-medium">{confirmation.roomName}</span></div>
                <div className="flex justify-between"><span className="text-gray-500">入住</span><span className="text-gray-900">{confirmation.checkIn}</span></div>
                <div className="flex justify-between"><span className="text-gray-500">退房</span><span className="text-gray-900">{confirmation.checkOut}</span></div>
                <div className="flex justify-between"><span className="text-gray-500">人數</span><span className="text-gray-900">{confirmation.guests} 人</span></div>
                {confirmation.total != null && (
                  <div className="flex justify-between border-t pt-1.5 mt-1.5">
                    <span className="text-gray-500">應付金額</span>
                    <span className="font-semibold text-gray-900">NT$ {fmt(confirmation.total)}</span>
                  </div>
                )}
              </div>
              <p className="text-sm text-gray-500 max-w-sm mx-auto">
                這是<strong>訂房申請</strong>，業者確認後會寄送確認信到 <strong>{form.guest_email}</strong>，請留意收件匣（含垃圾信件）。
              </p>
              <button onClick={() => { setStep('browse'); setForm({ ...EMPTY_FORM }); setSelectedProp(null); setPromoValid(null) }}
                className="px-6 py-2 rounded-xl text-white text-sm font-medium hover:opacity-90 transition-opacity"
                style={accentStyle}>
                再訂一間
              </button>
            </div>

          ) : step === 'form' ? (
            <div className="space-y-4">
              <button onClick={() => { setSelectedProp(null); setStep('browse') }}
                className="flex items-center gap-1 text-sm hover:underline" style={accentTextStyle}>
                ← 返回選擇房型
              </button>

              {selectedProp && (
                <div className="rounded-xl p-4 text-sm" style={{ backgroundColor: `${accent}15`, border: `1px solid ${accent}30` }}>
                  <div className="font-semibold" style={accentTextStyle}>{selectedProp.name}</div>
                  {n > 0 && finalPrice !== null && (
                    <div className="mt-1" style={accentTextStyle}>
                      {n} 晚 · NT$ {fmt(finalPrice)}
                      {promoValid && <span className="text-emerald-600 ml-2">（已折 NT$ {fmt(promoValid.discount)}）</span>}
                    </div>
                  )}
                </div>
              )}

              {/* Dates + guests */}
              <div className="bg-white rounded-2xl border p-5 space-y-4">
                <h3 className="font-semibold text-gray-900">入住資訊</h3>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-gray-600">入住日期 *</label>
                    <input type="date" value={form.check_in} min={todayStr}
                      onChange={e => { setForm(f => ({ ...f, check_in: e.target.value })); setPromoValid(null); setPromoError('') }}
                      className="w-full text-sm border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-300" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-gray-600">退房日期 *</label>
                    <input type="date" value={form.check_out} min={form.check_in || todayStr}
                      onChange={e => { setForm(f => ({ ...f, check_out: e.target.value })); setPromoValid(null); setPromoError('') }}
                      className="w-full text-sm border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-300" />
                  </div>
                </div>
                {datesInvalid && <p className="text-xs text-rose-500">退房日期必須晚於入住日期。</p>}
                {!datesInvalid && dateConflict && <p className="text-xs text-rose-500">所選日期已被預訂，請改選其他日期。</p>}

                <div className="space-y-1">
                  <label className="text-xs font-medium text-gray-600">入住人數</label>
                  <div className="flex items-center gap-2">
                    <button onClick={() => { setForm(f => ({ ...f, num_guests: Math.max(1, f.num_guests - 1) })); setPromoValid(null) }}
                      className="w-8 h-8 rounded-lg border flex items-center justify-center text-gray-600 hover:bg-gray-50">−</button>
                    <span className="w-8 text-center font-medium">{form.num_guests}</span>
                    <button onClick={() => { setForm(f => ({ ...f, num_guests: f.num_guests + 1 })); setPromoValid(null) }}
                      className="w-8 h-8 rounded-lg border flex items-center justify-center text-gray-600 hover:bg-gray-50">+</button>
                    {selectedProp?.max_guests && (
                      <span className="text-xs text-gray-400 ml-1">
                        上限 {selectedProp.max_guests} 人
                        {selectedProp.extra_guest_fee ? `，超額每人每晚加 NT$ ${fmt(selectedProp.extra_guest_fee)}` : ''}
                      </span>
                    )}
                  </div>
                  {overCapacity && <p className="text-xs text-rose-500">人數超過此房型上限，請減少人數或聯絡民宿。</p>}
                </div>
              </div>

              {/* Contact */}
              <div className="bg-white rounded-2xl border p-5 space-y-4">
                <h3 className="font-semibold text-gray-900">聯絡資料</h3>
                {[
                  { key: 'guest_name' as const, label: '姓名 *', type: 'text' },
                  { key: 'guest_email' as const, label: '電子郵件 *', type: 'email' },
                  { key: 'guest_phone' as const, label: '電話', type: 'tel' },
                ].map(({ key, label, type }) => (
                  <div key={key} className="space-y-1">
                    <label className="text-xs font-medium text-gray-600">{label}</label>
                    <input type={type} value={form[key]} onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                      className="w-full text-sm border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-300" />
                  </div>
                ))}
                <div className="space-y-1">
                  <label className="text-xs font-medium text-gray-600">備註</label>
                  <textarea value={form.notes} rows={3} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                    className="w-full text-sm border rounded-lg px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-indigo-300" />
                </div>
              </div>

              {/* Promo */}
              <div className="bg-white rounded-2xl border p-5 space-y-3">
                <h3 className="font-semibold text-gray-900 flex items-center gap-1.5"><Tag className="h-4 w-4" /> 優惠碼</h3>
                <div className="flex gap-2">
                  <input value={form.promo_code}
                    onChange={e => { setForm(f => ({ ...f, promo_code: e.target.value.toUpperCase() })); setPromoValid(null); setPromoError('') }}
                    placeholder="輸入優惠碼"
                    className="flex-1 text-sm border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-300" />
                  <button onClick={checkPromo} className="px-4 py-2 border rounded-lg text-sm hover:bg-gray-50" style={accentTextStyle}>套用</button>
                </div>
                {promoValid && <p className="text-xs text-emerald-600">✓ {promoValid.name}，折扣 NT$ {fmt(promoValid.discount)}</p>}
                {promoError && <p className="text-xs text-rose-500">{promoError}</p>}
              </div>

              {submitError && (
                <p className="text-sm text-rose-600 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2 text-center">{submitError}</p>
              )}
              <button onClick={submit}
                disabled={submitting || dateBlocked || overCapacity || !form.guest_name || !form.guest_email || !form.check_in || !form.check_out}
                className="w-full py-3.5 rounded-xl font-bold text-white text-sm disabled:opacity-50 hover:opacity-90 transition-opacity"
                style={accentStyle}>
                {submitting ? '送出中…' : '確認訂房申請'}
              </button>
              <p className="text-center text-xs text-gray-400">送出後業者將與您確認，費用採現場付款</p>
            </div>

          ) : (
            /* Browse / room selector */
            <div className="space-y-4">
              {properties.length === 0 ? (
                <div className="text-center py-12 text-gray-400">
                  <BedDouble className="h-10 w-10 mx-auto mb-3 text-gray-200" />
                  <p className="text-sm">目前無可訂房型</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {properties.map(prop => (
                    <div key={prop.id} className="bg-white rounded-xl border p-4 flex items-center justify-between gap-4">
                      <div className="flex items-center gap-3 min-w-0">
                        {prop.images && (prop.images as string[]).length > 0 && (
                          <img src={(prop.images as string[])[0]} alt={prop.name}
                            className="w-14 h-14 rounded-lg object-cover shrink-0" />
                        )}
                        <div className="min-w-0">
                          <div className="font-medium text-gray-900 text-sm">{prop.name}</div>
                          <div className="text-xs text-gray-500">最多 {prop.max_guests ?? 2} 人</div>
                          {prop.base_price && (
                            <div className="text-xs font-semibold mt-0.5" style={accentTextStyle}>NT$ {fmt(prop.base_price)} / 晚</div>
                          )}
                        </div>
                      </div>
                      <button onClick={() => { setSelectedProp(prop); setStep('form') }}
                        className="shrink-0 flex items-center gap-1 px-4 py-2 rounded-lg text-white text-sm font-medium hover:opacity-90 transition-opacity"
                        style={accentStyle}>
                        選擇 <ChevronRight className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                  <button onClick={() => { setSelectedProp(null); setStep('form') }}
                    className="w-full py-2.5 rounded-xl border text-sm text-gray-600 hover:bg-gray-50">
                    不指定房型，直接填寫資料
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </section>

      <footer className="border-t py-6 text-center text-xs text-gray-300">
        Powered by AI GATE
      </footer>
    </div>
  )
}
