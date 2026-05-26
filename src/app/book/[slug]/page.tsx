'use client'
import { useEffect, useState } from 'react'
import { use } from 'react'
import { MapPin, Phone, Mail, Users, Calendar, CheckCircle, Tag, BedDouble, ChevronRight } from 'lucide-react'

interface BnbProfile {
  name: string; description: string | null; address: string | null; phone: string | null
  email: string | null; images: string[] | null; check_in_time: string | null; check_out_time: string | null
  breakfast: { type: string; price_per_person: number; start_time: string; end_time: string } | null
}
interface Property {
  id: string; name: string; description: string | null; room_count: number
  base_price: number | null; extra_guest_fee: number | null; max_guests: number | null
  amenities: string[] | null; images: string[] | null
}

const EMPTY_FORM = {
  guest_name: '', guest_email: '', guest_phone: '',
  num_guests: 1, check_in: '', check_out: '', notes: '', promo_code: '',
}

function nights(ci: string, co: string) {
  if (!ci || !co) return 0
  return Math.max(0, Math.round((new Date(co).getTime() - new Date(ci).getTime()) / 86400000))
}

function calcPrice(prop: Property, n: number, guests: number) {
  if (!prop.base_price || n <= 0) return null
  const base  = prop.base_price * n
  const extra = (prop.extra_guest_fee ?? 0) * Math.max(0, guests - (prop.max_guests ?? 2)) * n
  return base + extra
}

function fmt(n: number) { return n.toLocaleString('zh-TW') }

type Step = 'browse' | 'form' | 'done'

export default function PublicBookingPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params)
  const [profile, setProfile]       = useState<BnbProfile | null>(null)
  const [properties, setProperties] = useState<Property[]>([])
  const [loading, setLoading]       = useState(true)
  const [notFound, setNotFound]     = useState(false)

  const [step, setStep]             = useState<Step>('browse')
  const [selectedProp, setSelectedProp] = useState<Property | null>(null)
  const [form, setForm]             = useState({ ...EMPTY_FORM })
  const [promoValid, setPromoValid] = useState<{ discount: number; name: string } | null>(null)
  const [promoError, setPromoError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')
  const [unavailable, setUnavailable] = useState<Set<string>>(new Set())
  const [confirmation, setConfirmation] = useState<
    { code: string; total: number | null; roomName: string; checkIn: string; checkOut: string; guests: number } | null
  >(null)

  const todayStr = new Date().toISOString().slice(0, 10)

  useEffect(() => {
    fetch(`/api/book/${slug}`)
      .then(r => { if (!r.ok) { setNotFound(true); return null } return r.json() })
      .then(d => { if (d) { setProfile(d.profile); setProperties(d.properties) } })
      .finally(() => setLoading(false))
  }, [slug])

  // 載入所選房型的不可訂日期，供即時提示
  useEffect(() => {
    if (!selectedProp) { setUnavailable(new Set()); return }
    fetch(`/api/book/${slug}/availability?property_id=${selectedProp.id}`)
      .then(r => r.json())
      .then(d => setUnavailable(new Set<string>(d.unavailable ?? [])))
      .catch(() => setUnavailable(new Set()))
  }, [selectedProp, slug])

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
  const basePrice = selectedProp ? calcPrice(selectedProp, n, form.num_guests) : null
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
    setSubmitError('')
    setSubmitting(true)
    try {
      const res = await fetch(`/api/book/${slug}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          property_id: selectedProp?.id ?? null,
          promo_code: promoValid ? form.promo_code : null,
        }),
      })
      const d = await res.json()
      if (!res.ok) {
        // 後端在我們送出前剛被別人訂走 → 重新整理可用日期
        if (res.status === 409 && selectedProp) {
          fetch(`/api/book/${slug}/availability?property_id=${selectedProp.id}`)
            .then(r => r.json()).then(a => setUnavailable(new Set<string>(a.unavailable ?? []))).catch(() => {})
        }
        setSubmitError(d.error ?? '訂房失敗，請稍後再試')
        return
      }
      setConfirmation({
        code: d.booking.confirmation_code,
        total: d.booking.total_price,
        roomName: selectedProp?.name ?? '不指定房型',
        checkIn: form.check_in,
        checkOut: form.check_out,
        guests: form.num_guests,
      })
      setStep('done')
    } catch {
      setSubmitError('網路錯誤，請稍後再試')
    } finally { setSubmitting(false) }
  }

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center text-gray-400">載入中…</div>
  )
  if (notFound || !profile) return (
    <div className="min-h-screen flex items-center justify-center text-gray-500">找不到此民宿</div>
  )

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Hero */}
      <div className="bg-white border-b">
        <div className="max-w-3xl mx-auto px-4 py-6 sm:py-8">
          {profile.images && profile.images.length > 0 && (
            <div className="rounded-2xl overflow-hidden mb-5 aspect-[16/6]">
              <img src={profile.images[0]} alt={profile.name} className="w-full h-full object-cover" />
            </div>
          )}
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">{profile.name}</h1>
          {profile.address && (
            <div className="flex items-center gap-1.5 text-sm text-gray-500 mt-1.5">
              <MapPin className="h-4 w-4 shrink-0" /> {profile.address}
            </div>
          )}
          {profile.description && (
            <p className="mt-3 text-sm text-gray-600 leading-relaxed">{profile.description}</p>
          )}
          <div className="flex flex-wrap gap-4 mt-4 text-xs text-gray-500">
            {profile.check_in_time && <span>入住 {profile.check_in_time} 後</span>}
            {profile.check_out_time && <span>退房 {profile.check_out_time} 前</span>}
            {profile.breakfast?.type === 'included' && <span>含早餐</span>}
            {profile.phone && (
              <a href={`tel:${profile.phone}`} className="flex items-center gap-1">
                <Phone className="h-3 w-3" />{profile.phone}
              </a>
            )}
            {profile.email && (
              <a href={`mailto:${profile.email}`} className="flex items-center gap-1">
                <Mail className="h-3 w-3" />{profile.email}
              </a>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
        {step === 'done' && confirmation ? (
          /* Success */
          <div className="bg-white rounded-2xl border p-8 text-center space-y-4">
            <CheckCircle className="h-14 w-14 text-emerald-500 mx-auto" />
            <h2 className="text-xl font-bold text-gray-900">訂房申請已送出！</h2>
            <p className="text-sm text-gray-500">確認碼：<span className="font-mono font-bold text-gray-900 text-base">{confirmation.code}</span></p>
            <div className="text-left text-sm bg-gray-50 rounded-xl p-4 max-w-sm mx-auto space-y-1.5">
              <div className="flex justify-between"><span className="text-gray-500">房型</span><span className="text-gray-900 font-medium">{confirmation.roomName}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">入住</span><span className="text-gray-900">{confirmation.checkIn}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">退房</span><span className="text-gray-900">{confirmation.checkOut}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">人數</span><span className="text-gray-900">{confirmation.guests} 人</span></div>
              {confirmation.total != null && (
                <div className="flex justify-between border-t pt-1.5 mt-1.5"><span className="text-gray-500">應付金額</span><span className="font-semibold text-gray-900">NT$ {fmt(confirmation.total)}</span></div>
              )}
            </div>
            <p className="text-sm text-gray-500 max-w-sm mx-auto">這是<strong>訂房申請</strong>，民宿業者確認後會寄送確認信到 <strong>{form.guest_email || '您的信箱'}</strong>，請留意收件匣（含垃圾信件）。費用採現場付款。</p>
            <button onClick={() => { setStep('browse'); setForm({ ...EMPTY_FORM }); setSelectedProp(null); setPromoValid(null) }}
              className="mt-2 px-6 py-2 bg-indigo-600 text-white rounded-xl text-sm font-medium hover:bg-indigo-700">
              再訂一間
            </button>
          </div>
        ) : step === 'form' ? (
          /* Booking form */
          <div className="space-y-4">
            <button onClick={() => setStep('browse')} className="flex items-center gap-1 text-sm text-indigo-600 hover:underline">
              ← 返回選擇房型
            </button>

            {selectedProp && (
              <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-4 text-sm">
                <div className="font-semibold text-indigo-900">{selectedProp.name}</div>
                {n > 0 && finalPrice !== null && (
                  <div className="text-indigo-700 mt-1">
                    {n} 晚 · NT$ {fmt(finalPrice)}
                    {promoValid && <span className="text-emerald-600 ml-2">（已折 NT$ {fmt(promoValid.discount)}）</span>}
                  </div>
                )}
              </div>
            )}

            <div className="bg-white rounded-2xl border p-5 space-y-4">
              <h2 className="font-semibold text-gray-900">入住資訊</h2>
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
              {!datesInvalid && dateConflict && <p className="text-xs text-rose-500">所選日期內有部分日已被預訂，請改選其他日期。</p>}
              <div className="space-y-1">
                <label className="text-xs font-medium text-gray-600">入住人數</label>
                <div className="flex items-center gap-2">
                  <button onClick={() => { setForm(f => ({ ...f, num_guests: Math.max(1, f.num_guests - 1) })); setPromoValid(null) }}
                    className="w-8 h-8 rounded-lg border flex items-center justify-center text-gray-600 hover:bg-gray-50">−</button>
                  <span className="w-8 text-center font-medium">{form.num_guests}</span>
                  <button onClick={() => { setForm(f => ({ ...f, num_guests: f.num_guests + 1 })); setPromoValid(null) }}
                    className="w-8 h-8 rounded-lg border flex items-center justify-center text-gray-600 hover:bg-gray-50">+</button>
                  {selectedProp?.max_guests && (
                    <span className="text-xs text-gray-400 ml-1">上限 {selectedProp.max_guests} 人{selectedProp.extra_guest_fee ? `，超過每人每晚加 NT$ ${fmt(selectedProp.extra_guest_fee)}` : ''}</span>
                  )}
                </div>
                {overCapacity && <p className="text-xs text-rose-500">人數超過此房型上限，請減少人數或聯絡民宿。</p>}
              </div>
            </div>

            <div className="bg-white rounded-2xl border p-5 space-y-4">
              <h2 className="font-semibold text-gray-900">聯絡資料</h2>
              <div className="space-y-1">
                <label className="text-xs font-medium text-gray-600">姓名 *</label>
                <input value={form.guest_name} onChange={e => setForm(f => ({ ...f, guest_name: e.target.value }))}
                  className="w-full text-sm border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-300" />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-gray-600">電子郵件 *</label>
                <input type="email" value={form.guest_email} onChange={e => setForm(f => ({ ...f, guest_email: e.target.value }))}
                  className="w-full text-sm border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-300" />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-gray-600">電話</label>
                <input type="tel" value={form.guest_phone} onChange={e => setForm(f => ({ ...f, guest_phone: e.target.value }))}
                  className="w-full text-sm border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-300" />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-gray-600">備註</label>
                <textarea value={form.notes} rows={3} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                  className="w-full text-sm border rounded-lg px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-indigo-300" />
              </div>
            </div>

            {/* Promo */}
            <div className="bg-white rounded-2xl border p-5 space-y-3">
              <h2 className="font-semibold text-gray-900 flex items-center gap-1.5"><Tag className="h-4 w-4" /> 優惠碼</h2>
              <div className="flex gap-2">
                <input value={form.promo_code} onChange={e => { setForm(f => ({ ...f, promo_code: e.target.value.toUpperCase() })); setPromoValid(null); setPromoError('') }}
                  placeholder="輸入優惠碼"
                  className="flex-1 text-sm border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-300" />
                <button onClick={checkPromo} className="px-4 py-2 border rounded-lg text-sm text-indigo-600 hover:bg-indigo-50">套用</button>
              </div>
              {promoValid && <p className="text-xs text-emerald-600">✓ {promoValid.name}，折扣 NT$ {fmt(promoValid.discount)}</p>}
              {promoError && <p className="text-xs text-rose-500">{promoError}</p>}
            </div>

            {submitError && (
              <p className="text-sm text-rose-600 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2 text-center">{submitError}</p>
            )}
            <button onClick={submit} disabled={submitting || dateBlocked || overCapacity || !form.guest_name || !form.guest_email || !form.check_in || !form.check_out}
              className="w-full py-3.5 rounded-xl font-bold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-sm">
              {submitting ? '送出中…' : '確認訂房申請'}
            </button>
            <p className="text-center text-xs text-gray-400">送出後業者將與您確認，費用採現場付款</p>
          </div>
        ) : (
          /* Browse rooms */
          <>
            <h2 className="font-semibold text-gray-900 text-lg">選擇房型</h2>
            {properties.length === 0 ? (
              <div className="text-center py-12 text-gray-400 text-sm">
                <BedDouble className="h-10 w-10 mx-auto mb-3 text-gray-200" />
                目前無可訂房型
              </div>
            ) : (
              <div className="space-y-4">
                {properties.map(prop => (
                  <div key={prop.id} className="bg-white rounded-2xl border overflow-hidden">
                    {prop.images && prop.images.length > 0 && (
                      <img src={prop.images[0]} alt={prop.name} className="w-full h-44 object-cover" />
                    )}
                    <div className="p-4 sm:p-5 space-y-3">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <h3 className="font-semibold text-gray-900">{prop.name}</h3>
                          {prop.description && <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{prop.description}</p>}
                        </div>
                        {prop.base_price && (
                          <div className="text-right shrink-0">
                            <div className="font-bold text-indigo-600">NT$ {fmt(prop.base_price)}</div>
                            <div className="text-xs text-gray-400">/ 晚</div>
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-3 text-xs text-gray-500">
                        <span className="flex items-center gap-1"><Users className="h-3.5 w-3.5" />最多 {prop.max_guests ?? 2} 人</span>
                        {prop.extra_guest_fee && prop.extra_guest_fee > 0 && (
                          <span>超額加收 NT$ {fmt(prop.extra_guest_fee)} / 人 / 晚</span>
                        )}
                      </div>
                      {prop.amenities && prop.amenities.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {prop.amenities.slice(0, 8).map(a => (
                            <span key={a} className="text-[11px] bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{a}</span>
                          ))}
                          {prop.amenities.length > 8 && <span className="text-[11px] text-gray-400">+{prop.amenities.length - 8}</span>}
                        </div>
                      )}
                      <button onClick={() => { setSelectedProp(prop); setStep('form') }}
                        className="w-full py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 flex items-center justify-center gap-1.5">
                        選擇此房型 <ChevronRight className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))}

                {/* Book without selecting room */}
                <button onClick={() => { setSelectedProp(null); setStep('form') }}
                  className="w-full py-2.5 rounded-xl border text-sm text-gray-600 hover:bg-gray-50">
                  不指定房型，直接填寫資料
                </button>
              </div>
            )}
          </>
        )}
      </div>

      <div className="text-center py-8 text-xs text-gray-300">Powered by AI GATE</div>
    </div>
  )
}
