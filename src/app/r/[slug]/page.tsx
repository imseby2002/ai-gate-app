'use client'

import { useEffect, useState, use } from 'react'
import {
  Sparkles, Calendar, Clock, User, Phone, Mail,
  CheckCircle2, ChevronRight, ChevronLeft, MapPin,
  Heart, ArrowRight, ShieldCheck, Check, CalendarDays
} from 'lucide-react'
import { ReserveStore, ReserveService, ReserveStaff, AvailableSlot } from '@/lib/reserve/types'
import { DEFAULT_STORE, DEFAULT_SERVICES, DEFAULT_STAFF } from '@/lib/reserve/mock-data'
import { cn } from '@/lib/utils/cn'

export default function PublicBookingPortal({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = use(params)

  const [store, setStore] = useState<ReserveStore>(DEFAULT_STORE)
  const [services, setServices] = useState<ReserveService[]>(DEFAULT_SERVICES)
  const [staffList, setStaffList] = useState<ReserveStaff[]>(DEFAULT_STAFF)
  const [loading, setLoading] = useState(true)

  // Booking Flow State
  // Step 1: Select Service -> Step 2: Select Staff -> Step 3: Select Date & Time -> Step 4: Customer Info -> Step 5: Confirmed
  const [step, setStep] = useState<1 | 2 | 3 | 4 | 5>(1)

  const [selectedService, setSelectedService] = useState<ReserveService | null>(null)
  const [selectedStaff, setSelectedStaff] = useState<ReserveStaff | null>(null) // null = any
  const [selectedDate, setSelectedDate] = useState<string>(() => new Date().toISOString().slice(0, 10))
  const [selectedSlot, setSelectedSlot] = useState<AvailableSlot | null>(null)
  const [slots, setSlots] = useState<AvailableSlot[]>([])
  const [loadingSlots, setLoadingSlots] = useState(false)

  // Customer Form
  const [customerName, setCustomerName] = useState('')
  const [customerPhone, setCustomerPhone] = useState('')
  const [customerEmail, setCustomerEmail] = useState('')
  const [customerNotes, setCustomerNotes] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [confirmedAppt, setConfirmedAppt] = useState<any>(null)
  const [errorMsg, setErrorMsg] = useState('')

  // Selected Category Filter for Step 1
  const [activeCategory, setActiveCategory] = useState<string>('all')

  useEffect(() => {
    async function loadPublicData() {
      try {
        const res = await fetch(`/api/reserve/public/${slug}`)
        const data = await res.json()
        if (data.store) setStore(data.store)
        if (data.services && data.services.length > 0) setServices(data.services)
        if (data.staff && data.staff.length > 0) setStaffList(data.staff)
      } catch (err) {
        console.error(err)
      } finally {
        setLoading(false)
      }
    }
    loadPublicData()
  }, [slug])

  // Fetch slots whenever date or staff changes in Step 3
  useEffect(() => {
    if (!selectedService || step !== 3) return
    async function fetchSlots() {
      setLoadingSlots(true)
      try {
        const staffParam = selectedStaff ? selectedStaff.id : 'any'
        const res = await fetch(
          `/api/reserve/slots?slug=${slug}&date=${selectedDate}&service_id=${selectedService?.id}&staff_id=${staffParam}`
        )
        const data = await res.json()
        if (data.slots) setSlots(data.slots)
      } catch (e) {
        console.error(e)
      } finally {
        setLoadingSlots(false)
      }
    }
    fetchSlots()
  }, [slug, selectedService, selectedStaff, selectedDate, step])

  const categories = ['all', ...Array.from(new Set(services.map(s => s.category_name || '精選服務')))]

  const filteredServices = activeCategory === 'all'
    ? services.filter(s => s.is_active)
    : services.filter(s => s.is_active && (s.category_name || '精選服務') === activeCategory)

  // Generate next 14 days for quick date picker
  const upcomingDates = Array.from({ length: 14 }).map((_, i) => {
    const d = new Date()
    d.setDate(d.getDate() + i)
    const iso = d.toISOString().slice(0, 10)
    const dayName = ['週日', '週一', '週二', '週三', '週四', '週五', '週六'][d.getDay()]
    return {
      iso,
      monthDay: `${d.getMonth() + 1}/${d.getDate()}`,
      dayName,
      isToday: i === 0,
    }
  })

  async function handleBookSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!customerName.trim() || !customerPhone.trim() || !selectedSlot) return
    setIsSubmitting(true)
    setErrorMsg('')

    try {
      const res = await fetch(`/api/reserve/public/${slug}/book`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          service_id: selectedService?.id,
          staff_id: selectedStaff ? selectedStaff.id : selectedSlot.staffId || null,
          customer_name: customerName,
          customer_phone: customerPhone,
          customer_email: customerEmail || null,
          customer_notes: customerNotes || null,
          start_time: selectedSlot.dateTime,
        }),
      })

      const data = await res.json()
      if (!res.ok) {
        setErrorMsg(data.error || '預約失敗，請稍後再試')
        return
      }

      setConfirmedAppt(data.appointment)
      setStep(5)
    } catch (err: any) {
      setErrorMsg(err.message || '網路連線異常')
    } finally {
      setIsSubmitting(false)
    }
  }

  function resetBooking() {
    setSelectedService(null)
    setSelectedStaff(null)
    setSelectedSlot(null)
    setCustomerName('')
    setCustomerPhone('')
    setCustomerEmail('')
    setCustomerNotes('')
    setConfirmedAppt(null)
    setStep(1)
  }

  // Industry terminology dictionary based on store category
  const industryCategory = (store.category || 'other').toLowerCase()
  const term = (() => {
    switch (industryCategory) {
      case 'clinic':
        return {
          systemBadge: '醫療門診與健康預約',
          serviceStepSubtitle: '請點擊您所需的門診或診療諮詢項目',
          staffStepTitle: '步驟 2：選擇主治醫師 / 治療師',
          staffDefaultTitle: '由診所安排 (不指定醫師/治療師)',
          staffDefaultDesc: '自動為您媒合當前看診空檔最充裕之醫師或專業治療師，預約速度最快！',
          staffBadge: '醫師 / 治療師',
          notesPlaceholder: '請在此填寫症狀描述、過往病史或就診特殊需求...',
          noticeLabel: '就診須知：',
        }
      case 'hair':
        return {
          systemBadge: '美髮沙龍線上預約',
          serviceStepSubtitle: '請點擊您所需的剪髮、染燙或護髮頭皮護理項目',
          staffStepTitle: '步驟 2：選擇指定設計師 / 造型總監',
          staffDefaultTitle: '由沙龍安排 (不指定設計師)',
          staffDefaultDesc: '自動為您媒合當前空檔最充裕之設計師，預約速度最快！',
          staffBadge: '設計師 / 造型師',
          notesPlaceholder: '請在此填寫髮質狀況、長度或欲指定髮型參考...',
          noticeLabel: '沙龍須知：',
        }
      case 'spa':
        return {
          systemBadge: '芳療 SPA 舒壓預約',
          serviceStepSubtitle: '請點擊您所需的精油舒壓或身體調理項目',
          staffStepTitle: '步驟 2：選擇專業芳療師',
          staffDefaultTitle: '由會館安排 (不指定芳療師)',
          staffDefaultDesc: '自動為您媒合當前空檔之資深芳療師，預約速度最快！',
          staffBadge: '芳療師',
          notesPlaceholder: '請在此填寫加強部位、精油偏好或力道需求...',
          noticeLabel: '預約須知：',
        }
      case 'beauty':
        return {
          systemBadge: '專業美業線上預約',
          serviceStepSubtitle: '請點擊您所需的美容、美甲美睫或保養項目',
          staffStepTitle: '步驟 2：選擇專業技師 / 美容師',
          staffDefaultTitle: '由店家安排 (不指定美容師)',
          staffDefaultDesc: '自動為您媒合當前空檔最充裕之資深技師，預約速度最快！',
          staffBadge: '美容師 / 技師',
          notesPlaceholder: '請在此留下膚況、過敏原或款式需求...',
          noticeLabel: '預約須知：',
        }
      case 'fitness':
        return {
          systemBadge: '私人教練與體態健身預約',
          serviceStepSubtitle: '請點擊您所需的個人重訓指導、皮拉提斯或體態諮詢項目',
          staffStepTitle: '步驟 2：選擇專業教練',
          staffDefaultTitle: '由場館安排 (不指定教練)',
          staffDefaultDesc: '自動為您媒合當前時段最合適之合格體適能教練，預約速度最快！',
          staffBadge: '專業教練 / 師資',
          notesPlaceholder: '請在此填寫訓練目標、運動傷害病史或體能狀況...',
          noticeLabel: '訓練須知：',
        }
      case 'pet':
        return {
          systemBadge: '寵物精緻美容與診療預約',
          serviceStepSubtitle: '請點擊您所需的毛孩洗護美容、造型或健康檢查項目',
          staffStepTitle: '步驟 2：選擇寵物美容師 / 獸醫師',
          staffDefaultTitle: '由門市安排 (不指定美容師)',
          staffDefaultDesc: '自動為您媒合經驗豐富之合格美容師，細心呵護您的毛孩！',
          staffBadge: '美容師 / 獸醫',
          notesPlaceholder: '請填寫寵物種類、品種、年齡、個性（如容易緊張）或特殊健康狀況...',
          noticeLabel: '毛孩須知：',
        }
      case 'consulting':
        return {
          systemBadge: '專業顧問諮詢線上預約',
          serviceStepSubtitle: '請點擊您所需的法律諮詢、會計稅務或專案諮詢項目',
          staffStepTitle: '步驟 2：選擇主辦顧問 / 律師 / 會計師',
          staffDefaultTitle: '由事務所安排 (不指定顧問)',
          staffDefaultDesc: '自動為您媒合專業領域相符之資深顧問，諮詢效率最高！',
          staffBadge: '專業顧問 / 專家',
          notesPlaceholder: '請簡述欲諮詢之案況背景、問題或需準備的文件資料...',
          noticeLabel: '諮詢須知：',
        }
      case 'auto':
        return {
          systemBadge: '汽車美容與鍍膜工藝預約',
          serviceStepSubtitle: '請點擊您所需的精緻洗車、石墨烯鍍膜或深層內裝護理項目',
          staffStepTitle: '步驟 2：選擇專業技師 / 工藝師',
          staffDefaultTitle: '由廠區安排 (不指定技師)',
          staffDefaultDesc: '自動為您排定當前具備空檔之專業技師施作，施工品質保證！',
          staffBadge: '專業技師 / 工藝師',
          notesPlaceholder: '請填寫您的車輛品牌、車型、年份與特別想加強處理的漆面或內裝部位...',
          noticeLabel: '施工須知：',
        }
      default:
        return {
          systemBadge: '專業服務線上預約平台',
          serviceStepSubtitle: '請點擊您所需的專業諮詢或服務項目',
          staffStepTitle: '步驟 2：選擇指定專業服務人員 / 顧問',
          staffDefaultTitle: '由店家安排 (不指定人員)',
          staffDefaultDesc: '自動為您媒合當前空檔最充裕之專業人員，預約速度最快！',
          staffBadge: '專業人員 / 專家',
          notesPlaceholder: '請在此填寫您的諮詢重點或特殊服務需求...',
          noticeLabel: '預約須知：',
        }
    }
  })()

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 flex flex-col">
      {/* Top Brand Banner */}
      <div className="bg-gradient-to-r from-rose-900 via-rose-950 to-slate-950 text-white relative overflow-hidden py-10 px-4 sm:px-6">
        <div className="absolute top-0 right-0 w-80 h-80 bg-rose-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="max-w-2xl mx-auto space-y-3 relative z-10 text-center sm:text-left sm:flex sm:items-center sm:gap-6">
          <div className="h-20 w-20 rounded-3xl bg-gradient-to-tr from-pink-500 to-rose-600 flex items-center justify-center text-white text-2xl font-bold shadow-xl shadow-rose-950/40 mx-auto sm:mx-0 shrink-0">
            {store.logo_url ? (
              <img src={store.logo_url} alt={store.name} className="h-full w-full object-cover rounded-3xl" />
            ) : (
              store.name[0]
            )}
          </div>

          <div className="space-y-1">
            <div className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-white/10 text-rose-300 text-xs font-semibold backdrop-blur-md">
              <Sparkles className="h-3 w-3" />
              {term.systemBadge}
            </div>
            <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight">
              {store.name}
            </h1>
            <p className="text-xs text-slate-300 line-clamp-2 max-w-lg">
              {store.description || '提供專屬客製化服務，立即選擇適合時段完成線上預約。'}
            </p>
            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-3 text-xs text-slate-400 pt-1">
              {store.phone && (
                <a href={`tel:${store.phone}`} className="flex items-center gap-1 hover:text-white transition-colors">
                  <Phone className="h-3.5 w-3.5 text-rose-400" />
                  {store.phone}
                </a>
              )}
              {store.address && (
                <span className="flex items-center gap-1">
                  <MapPin className="h-3.5 w-3.5 text-rose-400" />
                  {store.address}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Booking Wizard Steps Progress Bar */}
      {step < 5 && (
        <div className="bg-white dark:bg-slate-900 border-b border-slate-200/80 dark:border-slate-800 py-3 px-4 shadow-xs sticky top-0 z-30">
          <div className="max-w-2xl mx-auto flex items-center justify-between text-xs">
            {[
              { num: 1, title: '選擇項目' },
              { num: 2, title: '指定人員' },
              { num: 3, title: '預約時段' },
              { num: 4, title: '填寫資料' },
            ].map((s, idx) => {
              const active = step === s.num
              const passed = step > s.num
              return (
                <div key={s.num} className="flex items-center gap-2">
                  <div
                    className={cn(
                      'h-6 w-6 rounded-full flex items-center justify-center font-bold text-xs transition-all',
                      passed
                        ? 'bg-rose-600 text-white'
                        : active
                        ? 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300 ring-2 ring-rose-600'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-400'
                    )}
                  >
                    {passed ? <Check className="h-3.5 w-3.5" /> : s.num}
                  </div>
                  <span
                    className={cn(
                      'hidden sm:inline font-semibold',
                      active ? 'text-rose-600 dark:text-rose-400' : passed ? 'text-slate-800 dark:text-slate-200' : 'text-slate-400'
                    )}
                  >
                    {s.title}
                  </span>
                  {idx < 3 && <ChevronRight className="h-3.5 w-3.5 text-slate-300 dark:text-slate-700 mx-1 hidden sm:inline" />}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Main Container */}
      <div className="max-w-2xl mx-auto w-full flex-1 p-4 sm:p-6 space-y-6">
        {/* ================= STEP 1: SELECT SERVICE ================= */}
        {step === 1 && (
          <div className="space-y-4 animate-in fade-in duration-200">
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                步驟 1：選擇您想預約的服務項目
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                {term.serviceStepSubtitle}
              </p>
            </div>

            {/* Category tabs */}
            {categories.length > 2 && (
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
                {categories.map(c => (
                  <button
                    key={c}
                    onClick={() => setActiveCategory(c)}
                    className={cn(
                      'px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all',
                      activeCategory === c
                        ? 'bg-rose-600 text-white shadow-xs'
                        : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-800 hover:bg-slate-50'
                    )}
                  >
                    {c === 'all' ? '全部項目' : c}
                  </button>
                ))}
              </div>
            )}

            {/* Services Cards */}
            <div className="space-y-3">
              {filteredServices.map(srv => {
                const isSelected = selectedService?.id === srv.id
                return (
                  <div
                    key={srv.id}
                    onClick={() => setSelectedService(srv)}
                    className={cn(
                      'p-4 sm:p-5 rounded-3xl border bg-white dark:bg-slate-900 cursor-pointer transition-all flex flex-col justify-between gap-3 shadow-xs hover:shadow-md hover:scale-[1.01]',
                      isSelected
                        ? 'border-rose-600 ring-2 ring-rose-600/20 bg-rose-50/20 dark:bg-rose-950/20'
                        : 'border-slate-200/80 dark:border-slate-800 hover:border-rose-300'
                    )}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <span className="text-[10px] font-bold text-rose-600 bg-rose-50 dark:bg-rose-950/60 px-2 py-0.5 rounded-full mb-1 inline-block">
                          {srv.category_name}
                        </span>
                        <h3 className="font-bold text-sm text-slate-900 dark:text-white">
                          {srv.name}
                        </h3>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                          {srv.description}
                        </p>
                      </div>

                      <div className="text-right shrink-0">
                        {srv.sale_price ? (
                          <div>
                            <span className="text-xs text-slate-400 line-through block">
                              NT$ {srv.price.toLocaleString()}
                            </span>
                            <span className="text-base font-extrabold text-rose-600 tabular-nums">
                              NT$ {srv.sale_price.toLocaleString()}
                            </span>
                          </div>
                        ) : (
                          <span className="text-base font-extrabold text-slate-900 dark:text-white tabular-nums">
                            NT$ {srv.price.toLocaleString()}
                          </span>
                        )}
                        <span className="text-[11px] text-slate-400 block mt-0.5">
                          約 {srv.duration_minutes} 分鐘
                        </span>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Next Button */}
            <div className="pt-2">
              <button
                disabled={!selectedService}
                onClick={() => setStep(2)}
                className="w-full py-3 rounded-2xl bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white font-bold text-sm shadow-md shadow-rose-900/20 active:scale-95 transition-all flex items-center justify-center gap-2"
              >
                下一步：選擇服務人員 <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}

        {/* ================= STEP 2: SELECT STAFF ================= */}
        {step === 2 && (
          <div className="space-y-4 animate-in fade-in duration-200">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-slate-900 dark:text-white">
                  {term.staffStepTitle}
                </h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  已選服務：<span className="font-semibold text-rose-600">{selectedService?.name}</span>
                </p>
              </div>
              <button
                onClick={() => setStep(1)}
                className="text-xs text-slate-500 hover:text-slate-700 font-semibold flex items-center gap-1"
              >
                <ChevronLeft className="h-4 w-4" /> 重選服務
              </button>
            </div>

            <div className="space-y-3">
              {/* Option: Any Staff */}
              <div
                onClick={() => setSelectedStaff(null)}
                className={cn(
                  'p-4 rounded-3xl border bg-white dark:bg-slate-900 cursor-pointer transition-all flex items-center justify-between shadow-xs',
                  selectedStaff === null
                    ? 'border-rose-600 ring-2 ring-rose-600/20 bg-rose-50/20 dark:bg-rose-950/20'
                    : 'border-slate-200/80 dark:border-slate-800 hover:border-rose-300'
                )}
              >
                <div className="flex items-center gap-3">
                  <div className="h-11 w-11 rounded-2xl bg-gradient-to-tr from-pink-500 to-rose-600 text-white font-bold text-sm flex items-center justify-center">
                    <Sparkles className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-sm text-slate-900 dark:text-white">
                      {term.staffDefaultTitle}
                    </h3>
                    <p className="text-xs text-slate-400">
                      {term.staffDefaultDesc}
                    </p>
                  </div>
                </div>
                {selectedStaff === null && (
                  <CheckCircle2 className="h-5 w-5 text-rose-600" />
                )}
              </div>

              {/* Specific Staff */}
              {staffList.filter(s => s.is_active).map(staff => {
                const isSelected = selectedStaff?.id === staff.id
                return (
                  <div
                    key={staff.id}
                    onClick={() => setSelectedStaff(staff)}
                    className={cn(
                      'p-4 rounded-3xl border bg-white dark:bg-slate-900 cursor-pointer transition-all flex items-start justify-between shadow-xs',
                      isSelected
                        ? 'border-rose-600 ring-2 ring-rose-600/20 bg-rose-50/20 dark:bg-rose-950/20'
                        : 'border-slate-200/80 dark:border-slate-800 hover:border-rose-300'
                    )}
                  >
                    <div className="flex items-start gap-3">
                      <div className="h-11 w-11 rounded-2xl bg-slate-100 dark:bg-slate-800 text-rose-600 font-extrabold text-sm flex items-center justify-center overflow-hidden shrink-0">
                        {staff.avatar_url ? (
                          <img src={staff.avatar_url} alt={staff.name} className="h-full w-full object-cover" />
                        ) : (
                          staff.name[0]
                        )}
                      </div>
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <h3 className="font-bold text-sm text-slate-900 dark:text-white">
                            {staff.name}
                          </h3>
                          <span className="text-[11px] font-semibold text-rose-600 bg-rose-50 dark:bg-rose-950/60 px-2 py-0.5 rounded-full">
                            {staff.title}
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed">
                          {staff.bio || '專業技術認證，專注提供細緻呵護。'}
                        </p>
                      </div>
                    </div>

                    {isSelected && (
                      <CheckCircle2 className="h-5 w-5 text-rose-600 shrink-0 mt-1" />
                    )}
                  </div>
                )
              })}
            </div>

            <div className="pt-2">
              <button
                onClick={() => setStep(3)}
                className="w-full py-3 rounded-2xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-sm shadow-md shadow-rose-900/20 active:scale-95 transition-all flex items-center justify-center gap-2"
              >
                下一步：選擇預約日期與時段 <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}

        {/* ================= STEP 3: SELECT DATE & TIME ================= */}
        {step === 3 && (
          <div className="space-y-5 animate-in fade-in duration-200">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-slate-900 dark:text-white">
                  步驟 3：選擇日期與空檔時段
                </h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  服務人員：<span className="font-semibold text-rose-600">{selectedStaff?.name || '由門市安排'}</span>
                </p>
              </div>
              <button
                onClick={() => setStep(2)}
                className="text-xs text-slate-500 hover:text-slate-700 font-semibold flex items-center gap-1"
              >
                <ChevronLeft className="h-4 w-4" /> 回上一步
              </button>
            </div>

            {/* Quick 14-day horizontal strip */}
            <div className="space-y-1.5">
              <span className="text-xs font-bold text-slate-700 dark:text-slate-300">選擇日期：</span>
              <div className="flex items-center gap-2 overflow-x-auto pb-2 pt-1">
                {upcomingDates.map(d => {
                  const isCur = selectedDate === d.iso
                  return (
                    <button
                      key={d.iso}
                      onClick={() => {
                        setSelectedDate(d.iso)
                        setSelectedSlot(null)
                      }}
                      className={cn(
                        'flex flex-col items-center justify-center w-16 py-3 rounded-2xl border transition-all shrink-0',
                        isCur
                          ? 'bg-rose-600 text-white border-rose-600 shadow-md shadow-rose-900/20'
                          : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-800 hover:bg-slate-50'
                      )}
                    >
                      <span className="text-[10px] font-semibold opacity-80">{d.dayName}</span>
                      <span className="text-sm font-extrabold mt-0.5">{d.monthDay}</span>
                      {d.isToday && (
                        <span className={cn('text-[9px] font-bold mt-1 px-1 rounded', isCur ? 'bg-white/20 text-white' : 'bg-rose-50 text-rose-600')}>
                          今日
                        </span>
                      )}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Available Time Slots Grid */}
            <div className="space-y-2">
              <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                可預約時段 ({selectedDate})：
              </span>

              {loadingSlots ? (
                <div className="text-center py-12 text-slate-400 text-xs">
                  載入可預約時段中...
                </div>
              ) : slots.length === 0 ? (
                <div className="text-center py-12 bg-white dark:bg-slate-900 rounded-2xl border text-slate-400 text-xs">
                  該日無可預約時段或店家公休，請切換其他日期
                </div>
              ) : (
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2.5">
                  {slots.map((s, idx) => {
                    const isSelected = selectedSlot?.time === s.time
                    return (
                      <button
                        key={idx}
                        disabled={!s.available}
                        onClick={() => setSelectedSlot(s)}
                        className={cn(
                          'py-3 rounded-2xl border font-bold text-xs tabular-nums transition-all flex flex-col items-center justify-center gap-0.5',
                          !s.available
                            ? 'bg-slate-100 dark:bg-slate-800/40 text-slate-300 dark:text-slate-600 border-transparent cursor-not-allowed'
                            : isSelected
                            ? 'bg-rose-600 text-white border-rose-600 shadow-md shadow-rose-900/20 scale-[1.02]'
                            : 'bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 border-slate-200 dark:border-slate-800 hover:border-rose-400 hover:bg-rose-50/30'
                        )}
                      >
                        <span>{s.time}</span>
                        <span className="text-[9px] font-normal opacity-80">
                          {s.available ? (s.staffName ? s.staffName.split(' ')[0] : '可預約') : '已約滿'}
                        </span>
                      </button>
                    )
                  })}
                </div>
              )}
            </div>

            <div className="pt-2">
              <button
                disabled={!selectedSlot}
                onClick={() => setStep(4)}
                className="w-full py-3 rounded-2xl bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white font-bold text-sm shadow-md shadow-rose-900/20 active:scale-95 transition-all flex items-center justify-center gap-2"
              >
                下一步：填寫聯絡人資料 <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}

        {/* ================= STEP 4: CUSTOMER FORM ================= */}
        {step === 4 && (
          <form onSubmit={handleBookSubmit} className="space-y-5 animate-in fade-in duration-200">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-slate-900 dark:text-white">
                  步驟 4：填寫預約人資料
                </h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  我們將透過簡訊或 LINE 為您發送預約確認通知
                </p>
              </div>
              <button
                type="button"
                onClick={() => setStep(3)}
                className="text-xs text-slate-500 hover:text-slate-700 font-semibold flex items-center gap-1"
              >
                <ChevronLeft className="h-4 w-4" /> 重選時段
              </button>
            </div>

            {/* Booking Summary Box */}
            <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900 space-y-1.5 text-xs text-rose-950 dark:text-rose-200">
              <div className="flex items-center justify-between">
                <span className="font-bold text-sm text-rose-900 dark:text-rose-100">{selectedService?.name}</span>
                <span className="font-extrabold text-sm text-rose-600">
                  NT$ {(selectedService?.sale_price ?? selectedService?.price ?? 0).toLocaleString()}
                </span>
              </div>
              <div className="text-[11px] text-slate-600 dark:text-slate-300 flex items-center gap-2">
                <span>預約日期：{selectedDate} {selectedSlot?.time}</span>
                <span>•</span>
                <span>{term.staffBadge}：{selectedStaff?.name || selectedSlot?.staffName || '由門市安排'}</span>
              </div>
            </div>

            {errorMsg && (
              <div className="p-3 rounded-xl bg-red-50 text-red-700 text-xs font-semibold border border-red-200">
                {errorMsg}
              </div>
            )}

            <div className="space-y-3 text-xs">
              <div>
                <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                  您的姓名 *
                </label>
                <input
                  required
                  type="text"
                  placeholder="例如：林品妤小姐 / 王大明先生"
                  value={customerName}
                  onChange={e => setCustomerName(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 outline-none focus:border-rose-500 text-sm"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                  行動電話號碼 (接收預約通知) *
                </label>
                <input
                  required
                  type="tel"
                  placeholder="0912-345-678"
                  value={customerPhone}
                  onChange={e => setCustomerPhone(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 outline-none focus:border-rose-500 text-sm"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                  電子信箱 (選填)
                </label>
                <input
                  type="email"
                  placeholder="example@gmail.com"
                  value={customerEmail}
                  onChange={e => setCustomerEmail(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 outline-none focus:border-rose-500 text-sm"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                  需求備註 (選填)
                </label>
                <textarea
                  rows={2}
                  placeholder={term.notesPlaceholder}
                  value={customerNotes}
                  onChange={e => setCustomerNotes(e.target.value)}
                  className="w-full px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 outline-none focus:border-rose-500 text-xs leading-relaxed"
                />
              </div>
            </div>

            {store.notice && (
              <div className="p-3.5 rounded-2xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-[11px] text-slate-500 leading-relaxed whitespace-pre-line">
                <span className="font-bold text-slate-700 dark:text-slate-300 block mb-1">{term.noticeLabel}</span>
                {store.notice}
              </div>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-3.5 rounded-2xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-sm shadow-md shadow-rose-900/20 active:scale-95 transition-all flex items-center justify-center gap-2"
            >
              <Check className="h-4 w-4" />
              {isSubmitting ? '預約處理中...' : '確認並送出線上預約'}
            </button>
          </form>
        )}

        {/* ================= STEP 5: BOOKING CONFIRMED ================= */}
        {step === 5 && confirmedAppt && (
          <div className="bg-white dark:bg-slate-900 p-6 sm:p-8 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-xl space-y-6 text-center animate-in zoom-in-95 duration-200">
            <div className="h-16 w-16 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-600 flex items-center justify-center mx-auto shadow-md">
              <Check className="h-8 w-8 stroke-[2.5]" />
            </div>

            <div className="space-y-1">
              <h2 className="text-xl font-extrabold text-slate-900 dark:text-white">
                預約已成功送出！
              </h2>
              <p className="text-xs text-slate-500">
                感謝您的預約，門市將發送簡訊確認通知至您的手機。
              </p>
            </div>

            {/* Appointment Receipt Card */}
            <div className="p-5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-left space-y-2.5 text-xs">
              <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-700">
                <span className="text-slate-400">預約單號</span>
                <span className="font-mono font-bold text-slate-800 dark:text-slate-200">{confirmedAppt.appointment_no}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">服務項目</span>
                <span className="font-bold text-rose-600">{selectedService?.name}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">預約日期時段</span>
                <span className="font-bold text-slate-800 dark:text-slate-200 tabular-nums">
                  {selectedDate} {selectedSlot?.time}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">專屬服務人員</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200">
                  {selectedStaff?.name || selectedSlot?.staffName || '由門市排定'}
                </span>
              </div>
              <div className="flex items-center justify-between pt-2 border-t border-slate-200 dark:border-slate-700">
                <span className="text-slate-400">預估費用</span>
                <span className="font-extrabold text-sm text-emerald-600">
                  NT$ {(confirmedAppt.total_price || 0).toLocaleString()} (現場結算)
                </span>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
              <button
                onClick={resetBooking}
                className="w-full sm:w-auto px-6 py-2.5 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition-all"
              >
                再預約一筆
              </button>
              {store.phone && (
                <a
                  href={`tel:${store.phone}`}
                  className="w-full sm:w-auto px-6 py-2.5 rounded-2xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs shadow-md transition-all flex items-center justify-center gap-2"
                >
                  <Phone className="h-3.5 w-3.5" />
                  電話聯絡門市
                </a>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <footer className="py-6 border-t border-slate-200/80 dark:border-slate-800 text-center text-xs text-slate-400">
        Powered by AIGATE 專業智能預約排程系統 · {store.name}
      </footer>
    </div>
  )
}
