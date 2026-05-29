'use client'
import { useEffect, useState } from 'react'
import { use } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { Users, Tag, CheckCircle, BedDouble, ChevronLeft, Loader2 } from 'lucide-react'
import { getTemplate } from '@/lib/booking/templates'

interface BnbProfile {
  name: string; theme_color?: string | null; template_id?: string | null
  check_in_time?: string | null; check_out_time?: string | null; min_nights?: number | null
  booking_instructions?: string | null; cancellation_policy?: string | null
  breakfast?: { type: string; price_per_person: number; description?: string } | null
}
interface Property {
  id: string; name: string; description?: string | null
  base_price?: number | null; extra_guest_fee?: number | null; max_guests?: number | null
  images?: string[] | null
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

type Step = 'select' | 'form' | 'done'

export default function BookingPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params)
  const searchParams = useSearchParams()
  const preselectedRoom = searchParams.get('room')

  const [profile, setProfile]       = useState<BnbProfile | null>(null)
  const [properties, setProperties] = useState<Property[]>([])
  const [loading, setLoading]       = useState(true)
  const [notFound, setNotFound]     = useState(false)

  const [step, setStep]                 = useState<Step>('select')
  const [selectedProp, setSelectedProp] = useState<Property | null>(null)
  const [form, setForm]                 = useState({ ...EMPTY_FORM })
  const [promoValid, setPromoValid]     = useState<{ discount: number; name: string } | null>(null)
  const [promoError, setPromoError]     = useState('')
  const [submitting, setSubmitting]     = useState(false)
  const [submitError, setSubmitError]   = useState('')
  const [unavailable, setUnavailable]   = useState<Set<string>>(new Set())
  const [serverQuote, setServerQuote]   = useState<{ total: number } | null>(null)
  const [confirmation, setConfirmation] = useState<{
    code: string; total: number | null; roomName: string; checkIn: string; checkOut: string; guests: number
  } | null>(null)

  const todayStr = new Date().toISOString().slice(0, 10)

  useEffect(() => {
    fetch(`/api/book/${slug}`)
      .then(r => { if (!r.ok) { setNotFound(true); return null } return r.json() })
      .then(d => {
        if (d) {
          setProfile(d.profile)
          setProperties(d.properties)
          if (preselectedRoom) {
            const found = d.properties.find((p: Property) => p.id === preselectedRoom)
            if (found) { setSelectedProp(found); setStep('form') }
          }
        }
      })
      .finally(() => setLoading(false))
  }, [slug, preselectedRoom])

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

  function rangeConflict(ci: string, co: string) {
    if (!ci || !co) return false
    const start = new Date(`${ci}T00:00:00Z`).getTime()
    const end   = new Date(`${co}T00:00:00Z`).getTime()
    if (end <= start) return false
    for (let t = start; t < end; t += 86400000) {
      if (unavailable.has(new Date(t).toISOString().slice(0, 10))) return true
    }
    return false
  }

  async function checkPromo() {
    if (!form.promo_code) return
    setPromoError(''); setPromoValid(null)
    const n = nights(form.check_in, form.check_out)
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
        body: JSON.stringify({ ...form, property_id: selectedProp?.id ?? null, promo_code: promoValid ? form.promo_code : null }),
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

  const n = nights(form.check_in, form.check_out)
  const basePrice = serverQuote?.total ?? (
    selectedProp?.base_price
      ? selectedProp.base_price * n + Math.max(0, form.num_guests - (selectedProp.max_guests ?? 2)) * (selectedProp.extra_guest_fee ?? 0) * n
      : null
  )
  const finalPrice   = basePrice !== null ? Math.max(0, basePrice - (promoValid?.discount ?? 0)) : null
  const datesInvalid = !!(form.check_in && form.check_out && new Date(form.check_out) <= new Date(form.check_in))
  const dateConflict = rangeConflict(form.check_in, form.check_out)
  const dateBlocked  = datesInvalid || dateConflict
  const overCapacity = !!(selectedProp?.max_guests && form.num_guests > selectedProp.max_guests && !selectedProp.extra_guest_fee)

  const tpl    = getTemplate(profile?.template_id)
  const accent = profile?.theme_color || tpl.defaultAccent
  const aStyle = { backgroundColor: accent }
  const aText  = { color: accent }
  const aBg    = { backgroundColor: `${accent}12`, border: `1px solid ${accent}30` }

  if (loading) return (
    <div className="flex items-center justify-center min-h-[50vh] text-gray-400">
      <Loader2 className="h-6 w-6 animate-spin mr-2" />載入中…
    </div>
  )
  if (notFound) return (
    <div className="flex items-center justify-center min-h-[50vh] text-gray-400">找不到此民宿</div>
  )

  return (
    <div className="max-w-2xl mx-auto px-4 py-10 space-y-6">
      {/* Header */}
      <div>
        <h1 className={`text-2xl font-bold text-gray-900 ${profile.template_id === 'boutique' ? 'uppercase tracking-widest text-xl' : ''}`}>
          線上訂房
        </h1>
        {profile?.booking_instructions && (
          <p className="mt-2 text-sm text-gray-600 leading-relaxed">{profile.booking_instructions}</p>
        )}
      </div>

      {/* ── Done ── */}
      {step === 'done' && confirmation && (
        <div className="bg-white rounded-2xl border p-8 text-center space-y-4">
          <CheckCircle className="h-14 w-14 mx-auto text-emerald-500" />
          <h3 className="text-xl font-bold text-gray-900">訂房申請已送出！</h3>
          <p className="text-sm text-gray-500">確認碼：<span className="font-mono font-bold text-gray-900 text-base">{confirmation.code}</span></p>
          <div className="text-left text-sm bg-gray-50 rounded-xl p-4 max-w-sm mx-auto space-y-1.5">
            {[
              ['房型', confirmation.roomName],
              ['入住', confirmation.checkIn],
              ['退房', confirmation.checkOut],
              ['人數', `${confirmation.guests} 人`],
            ].map(([k, v]) => (
              <div key={k} className="flex justify-between">
                <span className="text-gray-500">{k}</span>
                <span className="text-gray-900 font-medium">{v}</span>
              </div>
            ))}
            {confirmation.total != null && (
              <div className="flex justify-between border-t pt-1.5 mt-1">
                <span className="text-gray-500">應付金額</span>
                <span className="font-bold text-gray-900">NT$ {fmt(confirmation.total)}</span>
              </div>
            )}
          </div>
          <p className="text-sm text-gray-500 max-w-sm mx-auto">
            業者確認後會寄確認信至 <strong>{form.guest_email}</strong>
          </p>
          <button onClick={() => { setStep('select'); setForm({ ...EMPTY_FORM }); setSelectedProp(null); setPromoValid(null) }}
            className={`px-6 py-2 text-white text-sm font-medium hover:opacity-90 ${tpl.btnRadius}`}
            style={aStyle}>再訂一間</button>
        </div>
      )}

      {/* ── Form ── */}
      {step === 'form' && (
        <div className="space-y-4">
          <button onClick={() => { setSelectedProp(null); setStep('select') }}
            className="flex items-center gap-1 text-sm hover:underline" style={aText}>
            <ChevronLeft className="h-4 w-4" />返回選擇房型
          </button>

          {selectedProp && (
            <div className="rounded-xl p-4 text-sm" style={aBg}>
              <div className="font-semibold" style={aText}>{selectedProp.name}</div>
              {n > 0 && finalPrice !== null && (
                <div className="mt-1" style={aText}>
                  {n} 晚 · NT$ {fmt(finalPrice)}
                  {promoValid && <span className="text-emerald-600 ml-2">（折 NT$ {fmt(promoValid.discount)}）</span>}
                </div>
              )}
            </div>
          )}

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
            {datesInvalid && <p className="text-xs text-rose-500">退房日期必須晚於入住日期</p>}
            {!datesInvalid && dateConflict && <p className="text-xs text-rose-500">所選日期已被預訂，請改選其他日期</p>}

            <div className="space-y-1">
              <label className="text-xs font-medium text-gray-600">入住人數</label>
              <div className="flex items-center gap-2">
                <button onClick={() => setForm(f => ({ ...f, num_guests: Math.max(1, f.num_guests - 1) }))}
                  className="w-8 h-8 rounded-lg border flex items-center justify-center text-gray-600 hover:bg-gray-50">−</button>
                <span className="w-8 text-center font-medium">{form.num_guests}</span>
                <button onClick={() => setForm(f => ({ ...f, num_guests: f.num_guests + 1 }))}
                  className="w-8 h-8 rounded-lg border flex items-center justify-center text-gray-600 hover:bg-gray-50">+</button>
                {selectedProp?.max_guests && (
                  <span className="text-xs text-gray-400 ml-1">
                    上限 {selectedProp.max_guests} 人
                    {selectedProp.extra_guest_fee ? `，超額每人晚 NT$ ${fmt(selectedProp.extra_guest_fee)}` : ''}
                  </span>
                )}
              </div>
              {overCapacity && <p className="text-xs text-rose-500">人數超過此房型上限</p>}
            </div>
          </div>

          <div className="bg-white rounded-2xl border p-5 space-y-4">
            <h3 className="font-semibold text-gray-900">聯絡資料</h3>
            {[
              { key: 'guest_name'  as const, label: '姓名 *', type: 'text' },
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

          <div className="bg-white rounded-2xl border p-5 space-y-3">
            <h3 className="font-semibold text-gray-900 flex items-center gap-1.5"><Tag className="h-4 w-4" />優惠碼</h3>
            <div className="flex gap-2">
              <input value={form.promo_code}
                onChange={e => { setForm(f => ({ ...f, promo_code: e.target.value.toUpperCase() })); setPromoValid(null); setPromoError('') }}
                placeholder="輸入優惠碼"
                className="flex-1 text-sm border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-300" />
              <button onClick={checkPromo} className="px-4 py-2 border rounded-lg text-sm hover:bg-gray-50" style={aText}>套用</button>
            </div>
            {promoValid && <p className="text-xs text-emerald-600">✓ {promoValid.name}，折扣 NT$ {fmt(promoValid.discount)}</p>}
            {promoError && <p className="text-xs text-rose-500">{promoError}</p>}
          </div>

          {submitError && (
            <p className="text-sm text-rose-600 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2 text-center">{submitError}</p>
          )}

          <button onClick={submit}
            disabled={submitting || dateBlocked || overCapacity || !form.guest_name || !form.guest_email || !form.check_in || !form.check_out}
            className={`w-full py-3.5 font-bold text-white text-sm disabled:opacity-50 hover:opacity-90 transition-opacity ${tpl.btnRadius}`}
            style={aStyle}>
            {submitting ? '送出中…' : '確認訂房申請'}
          </button>
          <p className="text-center text-xs text-gray-400">送出後業者將與您確認，費用採現場付款</p>

          {profile?.cancellation_policy && (
            <div className="bg-gray-50 rounded-xl p-4 text-xs text-gray-600 space-y-1">
              <div className="font-semibold text-gray-700">取消政策</div>
              <p>{profile.cancellation_policy}</p>
            </div>
          )}
        </div>
      )}

      {/* ── Select room ── */}
      {step === 'select' && (
        <div className="space-y-4">
          {properties.length === 0 ? (
            <div className="text-center py-16 text-gray-400">
              <BedDouble className="h-10 w-10 mx-auto mb-3 text-gray-200" />
              <p className="text-sm">目前無可訂房型</p>
            </div>
          ) : (
            <>
              <div className="space-y-3">
                {properties.map(prop => {
                  const img = (prop.images as string[] | null)?.[0]
                  return (
                    <div key={prop.id}
                      className="bg-white rounded-xl border p-4 flex items-center justify-between gap-4 hover:shadow-sm transition-shadow">
                      <div className="flex items-center gap-3 min-w-0">
                        {img && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={img} alt={prop.name} className="w-14 h-14 rounded-lg object-cover shrink-0" />
                        )}
                        <div className="min-w-0">
                          <div className="font-medium text-gray-900 text-sm">{prop.name}</div>
                          <div className="text-xs text-gray-500">最多 {prop.max_guests ?? 2} 人</div>
                          {prop.base_price && (
                            <div className="text-xs font-semibold mt-0.5" style={aText}>NT$ {fmt(prop.base_price)} / 晚</div>
                          )}
                        </div>
                      </div>
                      <button onClick={() => { setSelectedProp(prop); setStep('form') }}
                        className={`shrink-0 px-4 py-2 text-white text-sm font-medium hover:opacity-90 transition-opacity ${tpl.btnRadius}`}
                        style={aStyle}>
                        選擇
                      </button>
                    </div>
                  )
                })}
              </div>
              <button onClick={() => { setSelectedProp(null); setStep('form') }}
                className="w-full py-2.5 rounded-xl border text-sm text-gray-600 hover:bg-gray-50">
                不指定房型
              </button>
            </>
          )}

          {profile?.cancellation_policy && (
            <div className="bg-gray-50 rounded-xl p-4 text-xs text-gray-600 space-y-1">
              <div className="font-semibold text-gray-700">取消政策</div>
              <p>{profile.cancellation_policy}</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
