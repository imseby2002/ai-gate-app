'use client'

import { useEffect, useState } from 'react'
import {
  CalendarDays, ChevronLeft, ChevronRight, Plus, Users,
  Clock, CheckCircle2, AlertCircle, X, Search, Phone,
  Sparkles, Filter, Check
} from 'lucide-react'
import { ReserveAppointment, ReserveStaff, ReserveService } from '@/lib/reserve/types'
import { DEFAULT_STAFF, DEFAULT_SERVICES, generateInitialAppointments } from '@/lib/reserve/mock-data'
import { cn } from '@/lib/utils/cn'

const TIME_SLOTS = [
  '10:00', '11:00', '12:00', '13:00', '14:00',
  '15:00', '16:00', '17:00', '18:00', '19:00', '20:00'
]

export default function ReserveCalendarPage() {
  const [currentDate, setCurrentDate] = useState<string>(() => new Date().toISOString().slice(0, 10))
  const [appointments, setAppointments] = useState<ReserveAppointment[]>([])
  const [staffList, setStaffList] = useState<ReserveStaff[]>(DEFAULT_STAFF)
  const [services, setServices] = useState<ReserveService[]>(DEFAULT_SERVICES)
  const [selectedStaffId, setSelectedStaffId] = useState<string>('all')
  const [selectedAppt, setSelectedAppt] = useState<ReserveAppointment | null>(null)
  const [createModalOpen, setCreateModalOpen] = useState(false)
  const [createSlotInfo, setCreateSlotInfo] = useState<{ staffId?: string; time?: string }>({})

  // Form states
  const [formName, setFormName] = useState('')
  const [formPhone, setFormPhone] = useState('')
  const [formServiceId, setFormServiceId] = useState(DEFAULT_SERVICES[0]?.id || '')
  const [formStaffId, setFormStaffId] = useState(DEFAULT_STAFF[0]?.id || '')
  const [formTime, setFormTime] = useState('11:00')
  const [formNotes, setFormNotes] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    async function fetchData() {
      try {
        const [apptRes, staffRes, srvRes] = await Promise.all([
          fetch(`/api/reserve/appointments?from=${currentDate}T00:00:00&to=${currentDate}T23:59:59`).then(r => r.json()).catch(() => ({ appointments: generateInitialAppointments(currentDate) })),
          fetch('/api/reserve/staff').then(r => r.json()).catch(() => ({ staff: DEFAULT_STAFF })),
          fetch('/api/reserve/services').then(r => r.json()).catch(() => ({ services: DEFAULT_SERVICES })),
        ])
        if (apptRes.appointments) setAppointments(apptRes.appointments)
        if (staffRes.staff) setStaffList(staffRes.staff)
        if (srvRes.services) setServices(srvRes.services)
      } catch (e) {
        console.error(e)
      }
    }
    fetchData()
  }, [currentDate])

  function handlePrevDay() {
    const d = new Date(currentDate)
    d.setDate(d.getDate() - 1)
    setCurrentDate(d.toISOString().slice(0, 10))
  }

  function handleNextDay() {
    const d = new Date(currentDate)
    d.setDate(d.getDate() + 1)
    setCurrentDate(d.toISOString().slice(0, 10))
  }

  function handleToday() {
    setCurrentDate(new Date().toISOString().slice(0, 10))
  }

  const filteredStaff = selectedStaffId === 'all'
    ? staffList.filter(s => s.is_active)
    : staffList.filter(s => s.id === selectedStaffId)

  const dayAppointments = appointments.filter(a => {
    return a.start_time.startsWith(currentDate) && a.status !== 'cancelled'
  })

  function handleOpenCreate(staffId?: string, time?: string) {
    setCreateSlotInfo({ staffId, time })
    if (staffId) setFormStaffId(staffId)
    if (time) setFormTime(time)
    setCreateModalOpen(true)
  }

  async function handleCreateSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!formName || !formPhone || !formServiceId) return
    setIsSubmitting(true)

    const srv = services.find(s => s.id === formServiceId)
    const duration = srv?.duration_minutes || 60
    const startIso = `${currentDate}T${formTime}:00+08:00`
    const endIso = new Date(new Date(startIso).getTime() + duration * 60000).toISOString()

    try {
      const res = await fetch('/api/reserve/appointments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          service_id: formServiceId,
          staff_id: formStaffId || null,
          customer_name: formName,
          customer_phone: formPhone,
          customer_notes: formNotes,
          start_time: startIso,
          end_time: endIso,
          status: 'confirmed',
          total_price: srv?.sale_price ?? srv?.price ?? 1200,
          payment_status: 'unpaid',
        }),
      })
      const data = await res.json()
      if (data.appointment) {
        setAppointments(prev => [...prev, data.appointment])
      }
      setCreateModalOpen(false)
      setFormName('')
      setFormPhone('')
      setFormNotes('')
    } catch (err) {
      console.error(err)
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleUpdateStatus(id: string, newStatus: string) {
    try {
      await fetch('/api/reserve/appointments', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status: newStatus }),
      })
      setAppointments(prev =>
        prev.map(a => (a.id === id ? { ...a, status: newStatus as any } : a))
      )
      if (selectedAppt && selectedAppt.id === id) {
        setSelectedAppt(prev => (prev ? { ...prev, status: newStatus as any } : null))
      }
    } catch (e) {
      console.error(e)
    }
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      {/* Top Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-4 sm:p-5 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-2xl bg-rose-50 dark:bg-rose-950/50 flex items-center justify-center text-rose-600">
            <CalendarDays className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
              服務排班與預約行事曆
            </h1>
            <p className="text-xs text-muted-foreground">
              多人員時間軸視圖 · 即時掌握技師預約空檔與排程
            </p>
          </div>
        </div>

        {/* Date Selector and Buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center bg-slate-100 dark:bg-slate-800 rounded-2xl p-1">
            <button
              onClick={handlePrevDay}
              className="p-1.5 rounded-xl hover:bg-white dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition-colors"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <input
              type="date"
              value={currentDate}
              onChange={e => setCurrentDate(e.target.value)}
              className="bg-transparent text-xs font-bold px-2 text-slate-800 dark:text-slate-200 outline-none cursor-pointer"
            />
            <button
              onClick={handleNextDay}
              className="p-1.5 rounded-xl hover:bg-white dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition-colors"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          <button
            onClick={handleToday}
            className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 transition-all"
          >
            今日
          </button>

          {/* Filter Staff */}
          <select
            value={selectedStaffId}
            onChange={e => setSelectedStaffId(e.target.value)}
            className="text-xs font-medium px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 outline-none"
          >
            <option value="all">全體人員 ({staffList.length} 位)</option>
            {staffList.map(s => (
              <option key={s.id} value={s.id}>{s.name} ({s.title})</option>
            ))}
          </select>

          <button
            onClick={() => handleOpenCreate()}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold shadow-sm shadow-rose-900/20 active:scale-95 transition-all"
          >
            <Plus className="h-4 w-4" /> 新增預約
          </button>
        </div>
      </div>

      {/* Resource Timeline Grid */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-xs overflow-hidden">
        {/* Timeline Header Row (Staff Columns) */}
        <div className="overflow-x-auto">
          <div className="min-w-[800px]">
            <div className="grid grid-cols-[80px_repeat(auto-fit,minmax(180px,1fr))] border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/40">
              <div className="p-3 text-center text-xs font-bold text-slate-400 border-r border-slate-200 dark:border-slate-800">
                時段
              </div>
              {filteredStaff.map(staff => (
                <div
                  key={staff.id}
                  className="p-3 border-r border-slate-200 dark:border-slate-800 last:border-r-0 flex items-center justify-between"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="h-8 w-8 rounded-full bg-rose-100 dark:bg-rose-950 text-rose-700 font-bold text-xs flex items-center justify-center shrink-0">
                      {staff.name[0]}
                    </div>
                    <div className="min-w-0">
                      <div className="font-bold text-xs text-slate-900 dark:text-slate-100 truncate">
                        {staff.name}
                      </div>
                      <div className="text-[10px] text-muted-foreground truncate">
                        {staff.title}
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => handleOpenCreate(staff.id)}
                    className="p-1 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950 transition-colors"
                    title={`為 ${staff.name} 新增預約`}
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>

            {/* Time Slots Rows */}
            <div className="divide-y divide-slate-100 dark:divide-slate-800/80">
              {TIME_SLOTS.map(timeStr => {
                const hourNum = parseInt(timeStr.slice(0, 2), 10)
                return (
                  <div
                    key={timeStr}
                    className="grid grid-cols-[80px_repeat(auto-fit,minmax(180px,1fr))] min-h-[72px]"
                  >
                    {/* Time Label */}
                    <div className="p-2 text-center text-xs font-semibold text-slate-400 border-r border-slate-200 dark:border-slate-800 select-none bg-slate-50/30">
                      {timeStr}
                    </div>

                    {/* Columns for each staff */}
                    {filteredStaff.map(staff => {
                      // Find appointment starting in this hour for this staff
                      const matchedAppt = dayAppointments.find(a => {
                        if (a.staff_id !== staff.id) return false
                        const aHour = parseInt(a.start_time.slice(11, 13), 10)
                        return aHour === hourNum
                      })

                      const statusColors: Record<string, { bg: string; border: string; text: string }> = {
                        pending: { bg: 'bg-amber-50 dark:bg-amber-950/40', border: 'border-amber-300 dark:border-amber-800', text: 'text-amber-800 dark:text-amber-300' },
                        confirmed: { bg: 'bg-blue-50 dark:bg-blue-950/40', border: 'border-blue-300 dark:border-blue-800', text: 'text-blue-800 dark:text-blue-300' },
                        in_progress: { bg: 'bg-rose-50 dark:bg-rose-950/40', border: 'border-rose-300 dark:border-rose-800', text: 'text-rose-800 dark:text-rose-300' },
                        completed: { bg: 'bg-emerald-50 dark:bg-emerald-950/40', border: 'border-emerald-300 dark:border-emerald-800', text: 'text-emerald-800 dark:text-emerald-300' },
                      }

                      return (
                        <div
                          key={staff.id}
                          className="border-r border-slate-100 dark:border-slate-800 last:border-r-0 p-1.5 relative group hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors"
                        >
                          {matchedAppt ? (
                            <div
                              onClick={() => setSelectedAppt(matchedAppt)}
                              className={cn(
                                'h-full w-full rounded-xl p-2.5 border cursor-pointer transition-all shadow-xs hover:shadow-md hover:scale-[1.01] flex flex-col justify-between',
                                statusColors[matchedAppt.status]?.bg || 'bg-rose-50',
                                statusColors[matchedAppt.status]?.border || 'border-rose-200'
                              )}
                            >
                              <div className="flex items-start justify-between gap-1">
                                <span className="font-bold text-xs text-slate-900 dark:text-white truncate">
                                  {matchedAppt.customer_name}
                                </span>
                                <span className={cn('text-[10px] px-1 rounded font-semibold', statusColors[matchedAppt.status]?.text)}>
                                  {matchedAppt.start_time.slice(11, 16)}
                                </span>
                              </div>
                              <div className="text-[11px] text-slate-600 dark:text-slate-300 truncate">
                                {matchedAppt.service?.name || services.find(s => s.id === matchedAppt.service_id)?.name || '預約服務'}
                              </div>
                              <div className="text-[10px] text-slate-400 flex items-center justify-between pt-1">
                                <span>NT$ {matchedAppt.total_price.toLocaleString()}</span>
                                <span className="capitalize">{matchedAppt.status}</span>
                              </div>
                            </div>
                          ) : (
                            <button
                              onClick={() => handleOpenCreate(staff.id, timeStr)}
                              className="w-full h-full rounded-lg border border-dashed border-transparent group-hover:border-slate-300 dark:group-hover:border-slate-700 flex items-center justify-center text-slate-300 dark:text-slate-700 hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-all text-xs gap-1"
                            >
                              <Plus className="h-3 w-3" /> 可預約
                            </button>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Appointment Detail Drawer Modal */}
      {selectedAppt && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-3xl p-6 shadow-2xl border border-slate-200 dark:border-slate-800 space-y-5 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b">
              <div>
                <span className="text-[11px] font-mono text-slate-400">
                  {selectedAppt.appointment_no}
                </span>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  預約詳情與狀態維護
                </h3>
              </div>
              <button
                onClick={() => setSelectedAppt(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-3 p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60">
                <div>
                  <span className="text-xs text-slate-400 block">顧客姓名</span>
                  <span className="font-bold text-slate-800 dark:text-slate-200">{selectedAppt.customer_name}</span>
                </div>
                <div>
                  <span className="text-xs text-slate-400 block">聯絡電話</span>
                  <span className="font-bold text-slate-800 dark:text-slate-200 tabular-nums">{selectedAppt.customer_phone}</span>
                </div>
                <div>
                  <span className="text-xs text-slate-400 block">預約服務</span>
                  <span className="font-semibold text-rose-600">
                    {selectedAppt.service?.name || services.find(s => s.id === selectedAppt.service_id)?.name}
                  </span>
                </div>
                <div>
                  <span className="text-xs text-slate-400 block">服務人員</span>
                  <span className="font-semibold text-slate-700 dark:text-slate-300">
                    {staffList.find(s => s.id === selectedAppt.staff_id)?.name || '門市安排'}
                  </span>
                </div>
                <div>
                  <span className="text-xs text-slate-400 block">時間時段</span>
                  <span className="text-xs font-semibold tabular-nums">
                    {selectedAppt.start_time.slice(0, 10)} {selectedAppt.start_time.slice(11, 16)} ~ {selectedAppt.end_time.slice(11, 16)}
                  </span>
                </div>
                <div>
                  <span className="text-xs text-slate-400 block">金額與付款</span>
                  <span className="font-bold text-emerald-600">
                    NT$ {selectedAppt.total_price.toLocaleString()} ({selectedAppt.payment_status})
                  </span>
                </div>
              </div>

              {selectedAppt.customer_notes && (
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 text-xs">
                  <span className="text-slate-400 block font-semibold mb-0.5">顧客預約備註：</span>
                  <span className="text-slate-700 dark:text-slate-300">{selectedAppt.customer_notes}</span>
                </div>
              )}

              {/* Status Update Actions */}
              <div className="pt-2 space-y-2">
                <span className="text-xs font-bold text-slate-500">切換狀態：</span>
                <div className="grid grid-cols-4 gap-2">
                  <button
                    onClick={() => handleUpdateStatus(selectedAppt.id, 'confirmed')}
                    className={cn(
                      'py-2 rounded-xl text-xs font-bold transition-all',
                      selectedAppt.status === 'confirmed'
                        ? 'bg-blue-600 text-white shadow-xs'
                        : 'border border-blue-200 text-blue-600 hover:bg-blue-50'
                    )}
                  >
                    已確認
                  </button>
                  <button
                    onClick={() => handleUpdateStatus(selectedAppt.id, 'in_progress')}
                    className={cn(
                      'py-2 rounded-xl text-xs font-bold transition-all',
                      selectedAppt.status === 'in_progress'
                        ? 'bg-rose-600 text-white shadow-xs'
                        : 'border border-rose-200 text-rose-600 hover:bg-rose-50'
                    )}
                  >
                    服務中
                  </button>
                  <button
                    onClick={() => handleUpdateStatus(selectedAppt.id, 'completed')}
                    className={cn(
                      'py-2 rounded-xl text-xs font-bold transition-all',
                      selectedAppt.status === 'completed'
                        ? 'bg-emerald-600 text-white shadow-xs'
                        : 'border border-emerald-200 text-emerald-600 hover:bg-emerald-50'
                    )}
                  >
                    已完成
                  </button>
                  <button
                    onClick={() => handleUpdateStatus(selectedAppt.id, 'cancelled')}
                    className={cn(
                      'py-2 rounded-xl text-xs font-bold transition-all',
                      selectedAppt.status === 'cancelled'
                        ? 'bg-slate-600 text-white shadow-xs'
                        : 'border border-slate-200 text-slate-500 hover:bg-slate-50'
                    )}
                  >
                    已取消
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Quick Create Appointment Modal */}
      {createModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <form
            onSubmit={handleCreateSubmit}
            className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-3xl p-6 shadow-2xl border border-slate-200 dark:border-slate-800 space-y-4 animate-in fade-in zoom-in-95 duration-150"
          >
            <div className="flex items-center justify-between pb-3 border-b">
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Plus className="h-4 w-4 text-rose-600" />
                新增排程預約單
              </h3>
              <button
                type="button"
                onClick={() => setCreateModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                    顧客姓名 *
                  </label>
                  <input
                    required
                    type="text"
                    placeholder="例如：林小姐"
                    value={formName}
                    onChange={e => setFormName(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 outline-none focus:border-rose-500"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                    聯絡手機 *
                  </label>
                  <input
                    required
                    type="tel"
                    placeholder="0912-345-678"
                    value={formPhone}
                    onChange={e => setFormPhone(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 outline-none focus:border-rose-500"
                  />
                </div>
              </div>

              <div>
                <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                  預約服務項目 *
                </label>
                <select
                  value={formServiceId}
                  onChange={e => setFormServiceId(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 outline-none focus:border-rose-500"
                >
                  {services.map(s => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.duration_minutes} 分鐘 · NT$ {s.sale_price ?? s.price})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                    指定服務人員
                  </label>
                  <select
                    value={formStaffId}
                    onChange={e => setFormStaffId(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 outline-none focus:border-rose-500"
                  >
                    <option value="">由門市排定 (不指定)</option>
                    {staffList.map(s => (
                      <option key={s.id} value={s.id}>{s.name} ({s.title})</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                    開始時間
                  </label>
                  <select
                    value={formTime}
                    onChange={e => setFormTime(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 outline-none focus:border-rose-500"
                  >
                    {TIME_SLOTS.map(t => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                  內部交代與備註
                </label>
                <textarea
                  rows={2}
                  placeholder="例如：過敏史、習慣造型風格或重要備忘"
                  value={formNotes}
                  onChange={e => setFormNotes(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 outline-none focus:border-rose-500"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t">
              <button
                type="button"
                onClick={() => setCreateModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                取消
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-500 text-white shadow-xs transition-all active:scale-95"
              >
                {isSubmitting ? '建立中...' : '確認建立預約'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}
