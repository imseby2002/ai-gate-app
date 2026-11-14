'use client'

import { useEffect, useState, useMemo } from 'react'
import {
  ClipboardList, Search, Filter, Plus, Calendar, Clock,
  CheckCircle2, AlertCircle, X, ChevronRight, Phone,
  DollarSign, User, Sparkles
} from 'lucide-react'
import { ReserveAppointment, ReserveStaff, ReserveService } from '@/lib/reserve/types'
import { DEFAULT_STAFF, DEFAULT_SERVICES, generateInitialAppointments } from '@/lib/reserve/mock-data'
import { cn } from '@/lib/utils/cn'

export default function ReserveAppointmentsPage() {
  const [appointments, setAppointments] = useState<ReserveAppointment[]>([])
  const [staffList, setStaffList] = useState<ReserveStaff[]>(DEFAULT_STAFF)
  const [services, setServices] = useState<ReserveService[]>(DEFAULT_SERVICES)
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [staffFilter, setStaffFilter] = useState('all')
  const [loading, setLoading] = useState(true)
  const [selectedAppt, setSelectedAppt] = useState<ReserveAppointment | null>(null)

  const todayStr = new Date().toISOString().slice(0, 10)

  useEffect(() => {
    async function load() {
      try {
        const [apptRes, staffRes, srvRes] = await Promise.all([
          fetch('/api/reserve/appointments').then(r => r.json()).catch(() => ({ appointments: generateInitialAppointments(todayStr) })),
          fetch('/api/reserve/staff').then(r => r.json()).catch(() => ({ staff: DEFAULT_STAFF })),
          fetch('/api/reserve/services').then(r => r.json()).catch(() => ({ services: DEFAULT_SERVICES })),
        ])
        if (apptRes.appointments) {
          setAppointments(apptRes.appointments)
          // 從客服收件匣的客人資訊卡點進來（?id=預約 ID）→ 直接打開該筆預約
          const openId = new URLSearchParams(window.location.search).get('id')
          const target = openId ? (apptRes.appointments as ReserveAppointment[]).find(a => a.id === openId) : undefined
          if (target) { setSelectedAppt(target); setSearchQuery(target.appointment_no) }
        }
        if (staffRes.staff) setStaffList(staffRes.staff)
        if (srvRes.services) setServices(srvRes.services)
      } catch (e) {
        console.error(e)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [todayStr])

  const filteredAppointments = useMemo(() => {
    return appointments.filter(a => {
      if (statusFilter !== 'all' && a.status !== statusFilter) return false
      if (staffFilter !== 'all' && a.staff_id !== staffFilter) return false
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase()
        const matchName = a.customer_name?.toLowerCase().includes(q)
        const matchPhone = a.customer_phone?.includes(q)
        const matchNo = a.appointment_no?.toLowerCase().includes(q)
        if (!matchName && !matchPhone && !matchNo) return false
      }
      return true
    })
  }, [appointments, statusFilter, staffFilter, searchQuery])

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

  const statusMap: Record<string, { label: string; bg: string; text: string }> = {
    pending: { label: '待確認', bg: 'bg-amber-50 text-amber-700 border-amber-200', text: 'text-amber-700' },
    confirmed: { label: '已確認', bg: 'bg-blue-50 text-blue-700 border-blue-200', text: 'text-blue-700' },
    in_progress: { label: '服務中', bg: 'bg-rose-50 text-rose-700 border-rose-200', text: 'text-rose-700' },
    completed: { label: '已完成', bg: 'bg-emerald-50 text-emerald-700 border-emerald-200', text: 'text-emerald-700' },
    cancelled: { label: '已取消', bg: 'bg-slate-100 text-slate-500 border-slate-200', text: 'text-slate-500' },
    no_show: { label: '未出席', bg: 'bg-red-50 text-red-600 border-red-200', text: 'text-red-600' },
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-extrabold text-slate-900 dark:text-white flex items-center gap-2.5">
            <ClipboardList className="h-5 w-5 text-rose-600" />
            預約單據管理
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            即時查詢、篩選各門市預約名冊與到店結帳狀態
          </p>
        </div>
        <div className="text-xs text-slate-500 font-medium bg-white dark:bg-slate-800 px-3.5 py-1.5 rounded-full border border-slate-200 dark:border-slate-700 shrink-0 self-start sm:self-auto">
          共 <span className="font-bold text-rose-600">{filteredAppointments.length}</span> 筆預約單
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-3">
        <div className="flex flex-col md:flex-row items-center gap-3">
          {/* Search Input */}
          <div className="relative flex-1 w-full">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="搜尋顧客姓名、手機號碼或預約編號..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 text-xs rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 outline-none focus:border-rose-500"
            />
          </div>

          {/* Staff Filter */}
          <div className="flex items-center gap-2 w-full md:w-auto">
            <select
              value={staffFilter}
              onChange={e => setStaffFilter(e.target.value)}
              className="w-full md:w-48 px-3 py-2 text-xs rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800 text-slate-800 dark:text-slate-200 outline-none cursor-pointer"
            >
              <option value="all">全體服務人員</option>
              {staffList.map(s => (
                <option key={s.id} value={s.id}>{s.name} ({s.title})</option>
              ))}
            </select>
          </div>
        </div>

        {/* Status Filter Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 pt-1">
          {[
            { id: 'all', label: '全部狀態' },
            { id: 'pending', label: '待確認' },
            { id: 'confirmed', label: '已確認' },
            { id: 'in_progress', label: '服務中' },
            { id: 'completed', label: '已完成' },
            { id: 'cancelled', label: '已取消' },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setStatusFilter(tab.id)}
              className={cn(
                'px-3.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all',
                statusFilter === tab.id
                  ? 'bg-rose-600 text-white shadow-xs'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Appointments List / Table */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-xs overflow-hidden">
        {filteredAppointments.length === 0 ? (
          <div className="text-center py-16 text-slate-400 space-y-2">
            <ClipboardList className="h-12 w-12 mx-auto text-slate-300 dark:text-slate-700" />
            <p className="text-sm font-medium">沒有符合條件的預約單</p>
            <p className="text-xs text-slate-400">請嘗試調整搜尋條件或狀態標籤</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50/70 dark:bg-slate-950/40 border-b border-slate-200 dark:border-slate-800 text-slate-500 font-bold uppercase tracking-wider">
                <tr>
                  <th className="py-3.5 px-4">單號 / 建立時間</th>
                  <th className="py-3.5 px-4">顧客姓名 / 電話</th>
                  <th className="py-3.5 px-4">預約服務項目</th>
                  <th className="py-3.5 px-4">指定服務人員</th>
                  <th className="py-3.5 px-4">預約時間</th>
                  <th className="py-3.5 px-4">金額與付款</th>
                  <th className="py-3.5 px-4">預約狀態</th>
                  <th className="py-3.5 px-4 text-right">操作維護</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
                {filteredAppointments.map(apt => {
                  const status = statusMap[apt.status] || statusMap.confirmed
                  const staffObj = staffList.find(s => s.id === apt.staff_id)
                  const serviceObj = services.find(s => s.id === apt.service_id)

                  return (
                    <tr
                      key={apt.id}
                      className="hover:bg-rose-50/20 dark:hover:bg-rose-950/10 transition-colors"
                    >
                      <td className="py-3.5 px-4 font-mono font-medium text-slate-700 dark:text-slate-300">
                        {apt.appointment_no}
                        <div className="text-[10px] text-slate-400 font-sans">
                          {apt.created_at ? apt.created_at.slice(0, 10) : todayStr}
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-slate-900 dark:text-white">
                          {apt.customer_name}
                        </div>
                        <div className="text-[11px] text-slate-400 tabular-nums">
                          {apt.customer_phone}
                        </div>
                      </td>
                      <td className="py-3.5 px-4 font-medium text-rose-600">
                        {apt.service?.name || serviceObj?.name || '極致美學療程'}
                        {apt.customer_notes && (
                          <div className="text-[10px] text-slate-400 line-clamp-1">
                            備註：{apt.customer_notes}
                          </div>
                        )}
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="font-medium text-slate-800 dark:text-slate-200">
                          {staffObj?.name || '門市安排 (不指定)'}
                        </span>
                        {staffObj?.title && (
                          <div className="text-[10px] text-slate-400">{staffObj.title}</div>
                        )}
                      </td>
                      <td className="py-3.5 px-4 tabular-nums">
                        <div className="font-semibold text-slate-800 dark:text-slate-200">
                          {apt.start_time.slice(0, 10)}
                        </div>
                        <div className="text-[11px] text-slate-400">
                          {apt.start_time.slice(11, 16)} ~ {apt.end_time.slice(11, 16)}
                        </div>
                      </td>
                      <td className="py-3.5 px-4 tabular-nums">
                        <div className="font-bold text-slate-900 dark:text-slate-100">
                          NT$ {apt.total_price.toLocaleString()}
                        </div>
                        <div className="text-[10px] text-slate-400 capitalize">
                          {apt.payment_status === 'deposit_paid' ? '已付定金' : apt.payment_status === 'paid' ? '已付清' : '現場付款'}
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        <span className={cn('px-2.5 py-1 rounded-full border text-[11px] font-semibold', status.bg)}>
                          {status.label}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {apt.status === 'pending' && (
                            <button
                              onClick={() => handleUpdateStatus(apt.id, 'confirmed')}
                              className="px-2.5 py-1 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-semibold shadow-xs"
                            >
                              確認
                            </button>
                          )}
                          {apt.status === 'confirmed' && (
                            <button
                              onClick={() => handleUpdateStatus(apt.id, 'in_progress')}
                              className="px-2.5 py-1 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-semibold shadow-xs"
                            >
                              到店
                            </button>
                          )}
                          {apt.status === 'in_progress' && (
                            <button
                              onClick={() => handleUpdateStatus(apt.id, 'completed')}
                              className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold shadow-xs"
                            >
                              完成
                            </button>
                          )}
                          <button
                            onClick={() => setSelectedAppt(apt)}
                            className="px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100"
                          >
                            詳情
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Detail Modal */}
      {selectedAppt && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-3xl p-6 shadow-2xl border border-slate-200 dark:border-slate-800 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b">
              <div>
                <span className="text-xs font-mono text-slate-400">{selectedAppt.appointment_no}</span>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">預約單詳細資料</h3>
              </div>
              <button onClick={() => setSelectedAppt(null)} className="p-1 rounded-lg text-slate-400 hover:text-slate-600">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3 p-3 rounded-2xl bg-slate-50 dark:bg-slate-800">
                <div>
                  <span className="text-slate-400 block">顧客</span>
                  <span className="font-bold text-sm text-slate-800 dark:text-slate-200">{selectedAppt.customer_name}</span>
                </div>
                <div>
                  <span className="text-slate-400 block">手機</span>
                  <span className="font-bold text-sm text-slate-800 dark:text-slate-200 tabular-nums">{selectedAppt.customer_phone}</span>
                </div>
                <div>
                  <span className="text-slate-400 block">服務</span>
                  <span className="font-semibold text-rose-600">{selectedAppt.service?.name || services.find(s => s.id === selectedAppt.service_id)?.name}</span>
                </div>
                <div>
                  <span className="text-slate-400 block">技師/人員</span>
                  <span className="font-semibold text-slate-700 dark:text-slate-300">{staffList.find(s => s.id === selectedAppt.staff_id)?.name || '未指定'}</span>
                </div>
                <div>
                  <span className="text-slate-400 block">預約時間</span>
                  <span className="font-semibold tabular-nums">{selectedAppt.start_time.slice(0, 10)} {selectedAppt.start_time.slice(11, 16)}</span>
                </div>
                <div>
                  <span className="text-slate-400 block">結算金額</span>
                  <span className="font-bold text-emerald-600">NT$ {selectedAppt.total_price.toLocaleString()}</span>
                </div>
              </div>

              {selectedAppt.customer_notes && (
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800">
                  <span className="text-slate-400 block font-semibold mb-0.5">顧客需求備註：</span>
                  <span className="text-slate-700 dark:text-slate-300">{selectedAppt.customer_notes}</span>
                </div>
              )}

              <div className="pt-2">
                <span className="font-semibold text-slate-500 block mb-2">更新預約狀態：</span>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    onClick={() => handleUpdateStatus(selectedAppt.id, 'confirmed')}
                    className="py-2 rounded-xl border border-blue-200 text-blue-600 hover:bg-blue-50 font-bold"
                  >
                    已確認
                  </button>
                  <button
                    onClick={() => handleUpdateStatus(selectedAppt.id, 'in_progress')}
                    className="py-2 rounded-xl border border-rose-200 text-rose-600 hover:bg-rose-50 font-bold"
                  >
                    服務中
                  </button>
                  <button
                    onClick={() => handleUpdateStatus(selectedAppt.id, 'completed')}
                    className="py-2 rounded-xl border border-emerald-200 text-emerald-600 hover:bg-emerald-50 font-bold"
                  >
                    已完成
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
