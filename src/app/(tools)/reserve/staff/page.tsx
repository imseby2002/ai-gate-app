'use client'

import { useEffect, useState } from 'react'
import {
  Users, Plus, Clock, Edit2, CheckCircle2, X,
  Calendar, Briefcase, Sparkles, Check, UserCheck
} from 'lucide-react'
import { ReserveStaff, ReserveService, StaffWeeklySchedule } from '@/lib/reserve/types'
import { DEFAULT_STAFF, DEFAULT_SERVICES } from '@/lib/reserve/mock-data'
import { cn } from '@/lib/utils/cn'

const DAYS = [
  { key: 'mon', label: '週一' },
  { key: 'tue', label: '週二' },
  { key: 'wed', label: '週三' },
  { key: 'thu', label: '週四' },
  { key: 'fri', label: '週五' },
  { key: 'sat', label: '週六' },
  { key: 'sun', label: '週日' },
] as const

const DEFAULT_SCHEDULE: StaffWeeklySchedule = {
  mon: { work: true, start: '10:00', end: '20:00' },
  tue: { work: true, start: '10:00', end: '20:00' },
  wed: { work: true, start: '10:00', end: '20:00' },
  thu: { work: true, start: '10:00', end: '20:00' },
  fri: { work: true, start: '10:00', end: '20:00' },
  sat: { work: true, start: '10:00', end: '19:00' },
  sun: { work: false, start: '10:00', end: '18:00' },
}

export default function ReserveStaffPage() {
  const [staffList, setStaffList] = useState<ReserveStaff[]>([])
  const [services, setServices] = useState<ReserveService[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [editingStaff, setEditingStaff] = useState<ReserveStaff | null>(null)

  // Form states
  const [formName, setFormName] = useState('')
  const [formTitle, setFormTitle] = useState('')
  const [formAvatar, setFormAvatar] = useState('')
  const [formBio, setFormBio] = useState('')
  const [formServiceIds, setFormServiceIds] = useState<string[]>([])
  const [formSchedule, setFormSchedule] = useState<StaffWeeklySchedule>(DEFAULT_SCHEDULE)
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    async function loadData() {
      try {
        const [staffRes, srvRes] = await Promise.all([
          fetch('/api/reserve/staff').then(r => r.json()).catch(() => ({ staff: DEFAULT_STAFF })),
          fetch('/api/reserve/services').then(r => r.json()).catch(() => ({ services: DEFAULT_SERVICES })),
        ])
        if (staffRes.staff) setStaffList(staffRes.staff)
        if (srvRes.services) setServices(srvRes.services)
      } catch (e) {
        console.error(e)
      } finally {
        setLoading(false)
      }
    }
    loadData()
  }, [])

  function openAddModal() {
    setEditingStaff(null)
    setFormName('')
    setFormTitle('造型設計師')
    setFormAvatar('')
    setFormBio('')
    setFormServiceIds([])
    setFormSchedule(DEFAULT_SCHEDULE)
    setModalOpen(true)
  }

  function openEditModal(staff: ReserveStaff) {
    setEditingStaff(staff)
    setFormName(staff.name)
    setFormTitle(staff.title)
    setFormAvatar(staff.avatar_url || '')
    setFormBio(staff.bio || '')
    setFormServiceIds(staff.service_ids || [])
    setFormSchedule(staff.weekly_schedule || DEFAULT_SCHEDULE)
    setModalOpen(true)
  }

  function toggleService(serviceId: string) {
    setFormServiceIds(prev =>
      prev.includes(serviceId) ? prev.filter(id => id !== serviceId) : [...prev, serviceId]
    )
  }

  function handleScheduleChange(dayKey: keyof StaffWeeklySchedule, field: 'work' | 'start' | 'end', value: any) {
    setFormSchedule(prev => ({
      ...prev,
      [dayKey]: {
        ...prev[dayKey],
        [field]: value,
      },
    }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!formName.trim()) return
    setIsSubmitting(true)

    const payload = {
      name: formName,
      title: formTitle || '服務專家',
      avatar_url: formAvatar || null,
      bio: formBio || null,
      service_ids: formServiceIds,
      weekly_schedule: formSchedule,
      is_active: true,
      sort_order: 1,
    }

    try {
      if (editingStaff) {
        const res = await fetch('/api/reserve/staff', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: editingStaff.id, ...payload }),
        })
        const data = await res.json()
        if (data.staff) {
          setStaffList(prev => prev.map(s => (s.id === editingStaff.id ? data.staff : s)))
        }
      } else {
        const res = await fetch('/api/reserve/staff', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
        const data = await res.json()
        if (data.staff) {
          setStaffList(prev => [...prev, data.staff])
        }
      }
      setModalOpen(false)
    } catch (err) {
      console.error(err)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-extrabold text-slate-900 dark:text-white flex items-center gap-2.5">
            <Users className="h-5 w-5 text-rose-600" />
            服務人員與排班管理
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            設定設計師、美療師、醫師專長、可施作項目與每週出勤班表
          </p>
        </div>
        <button
          onClick={openAddModal}
          className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-2xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold shadow-md shadow-rose-900/20 active:scale-95 transition-all self-start sm:self-auto"
        >
          <Plus className="h-4 w-4" /> 新增服務人員
        </button>
      </div>

      {/* Staff Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {staffList.map(staff => {
          return (
            <div
              key={staff.id}
              className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/80 dark:border-slate-800 p-5 shadow-xs flex flex-col justify-between hover:border-rose-200 dark:hover:border-rose-900 transition-all"
            >
              <div className="space-y-4">
                {/* Header Profile */}
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-12 w-12 rounded-2xl bg-gradient-to-tr from-pink-500 to-rose-600 text-white font-extrabold text-base flex items-center justify-center shadow-xs overflow-hidden shrink-0">
                      {staff.avatar_url ? (
                        <img src={staff.avatar_url} alt={staff.name} className="h-full w-full object-cover" />
                      ) : (
                        staff.name[0]
                      )}
                    </div>
                    <div>
                      <h3 className="font-bold text-sm text-slate-900 dark:text-white">
                        {staff.name}
                      </h3>
                      <div className="text-xs text-rose-600 font-medium">
                        {staff.title}
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={() => openEditModal(staff)}
                    className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                  >
                    <Edit2 className="h-4 w-4" />
                  </button>
                </div>

                {/* Bio */}
                <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 leading-relaxed">
                  {staff.bio || '持專業技術證照，專注於細膩服務與高客製化體驗。'}
                </p>

                {/* Assigned Services */}
                <div className="space-y-1.5">
                  <span className="text-[11px] font-semibold text-slate-400 block">負責項目：</span>
                  <div className="flex flex-wrap gap-1">
                    {!staff.service_ids || staff.service_ids.length === 0 ? (
                      <span className="text-[10px] px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                        全部服務項目均可施作
                      </span>
                    ) : (
                      staff.service_ids.map(sid => {
                        const srv = services.find(s => s.id === sid)
                        return (
                          <span
                            key={sid}
                            className="text-[10px] px-2 py-0.5 rounded-md bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 font-medium"
                          >
                            {srv?.name || sid}
                          </span>
                        )
                      })
                    )}
                  </div>
                </div>

                {/* Weekly Shift Pill Overview */}
                <div className="space-y-1.5 pt-2 border-t border-slate-100 dark:border-slate-800">
                  <span className="text-[11px] font-semibold text-slate-400 block">每週出勤概況：</span>
                  <div className="grid grid-cols-7 gap-1 text-center">
                    {DAYS.map(d => {
                      const shift = staff.weekly_schedule?.[d.key as keyof StaffWeeklySchedule]
                      const works = shift?.work
                      return (
                        <div
                          key={d.key}
                          className={cn(
                            'p-1 rounded-lg text-[10px] font-bold',
                            works
                              ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300'
                              : 'bg-slate-100 text-slate-400 dark:bg-slate-800'
                          )}
                          title={works ? `${d.label} ${shift?.start}~${shift?.end}` : `${d.label} 休假`}
                        >
                          <div>{d.label[1]}</div>
                          <div className="text-[8px] font-normal">{works ? '班' : '休'}</div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Edit / Create Staff Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <form
            onSubmit={handleSubmit}
            className="bg-white dark:bg-slate-900 w-full max-w-xl max-h-[90vh] overflow-y-auto rounded-3xl p-6 shadow-2xl border border-slate-200 dark:border-slate-800 space-y-4 animate-in fade-in zoom-in-95 duration-150"
          >
            <div className="flex items-center justify-between pb-3 border-b">
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Users className="h-4 w-4 text-rose-600" />
                {editingStaff ? '維護服務人員班表' : '新增服務人員'}
              </h3>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                    姓名 / 暱稱 *
                  </label>
                  <input
                    required
                    type="text"
                    placeholder="例如：張家瑋 (Leo)"
                    value={formName}
                    onChange={e => setFormName(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 outline-none focus:border-rose-500"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                    職稱 / 專長 *
                  </label>
                  <input
                    required
                    type="text"
                    placeholder="例如：特約造型總監 / 主治醫師"
                    value={formTitle}
                    onChange={e => setFormTitle(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 outline-none focus:border-rose-500"
                  />
                </div>
              </div>

              <div>
                <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                  個人頭像相片網址
                </label>
                <input
                  type="url"
                  placeholder="https://..."
                  value={formAvatar}
                  onChange={e => setFormAvatar(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 outline-none focus:border-rose-500"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                  經歷簡介 (前台線上預約時會展示給客人)
                </label>
                <textarea
                  rows={2}
                  placeholder="介紹專業資歷、證照、專長風格..."
                  value={formBio}
                  onChange={e => setFormBio(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 outline-none focus:border-rose-500"
                />
              </div>

              {/* Service Selection */}
              <div>
                <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                  授權可施作項目 (未勾選則預設全項目均可預約)
                </label>
                <div className="grid grid-cols-2 gap-2 max-h-36 overflow-y-auto p-2 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700">
                  {services.map(s => {
                    const checked = formServiceIds.includes(s.id)
                    return (
                      <label
                        key={s.id}
                        className={cn(
                          'flex items-center gap-2 p-1.5 rounded-lg border text-[11px] cursor-pointer select-none transition-all',
                          checked ? 'bg-rose-50 border-rose-300 text-rose-800' : 'bg-white dark:bg-slate-800 border-slate-200 text-slate-700'
                        )}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleService(s.id)}
                          className="rounded text-rose-600 focus:ring-rose-500"
                        />
                        <span className="truncate">{s.name}</span>
                      </label>
                    )
                  })}
                </div>
              </div>

              {/* Weekly Roster */}
              <div className="space-y-2">
                <label className="font-semibold text-slate-700 dark:text-slate-300 block">
                  每週出勤排班表 (勾選上班日並設定營業時段)
                </label>
                <div className="space-y-2 bg-slate-50 dark:bg-slate-800/50 p-3 rounded-2xl border border-slate-200 dark:border-slate-700">
                  {DAYS.map(d => {
                    const shift = formSchedule[d.key as keyof StaffWeeklySchedule]
                    return (
                      <div key={d.key} className="flex items-center gap-3 text-xs">
                        <label className="flex items-center gap-1.5 w-16 font-bold cursor-pointer">
                          <input
                            type="checkbox"
                            checked={shift?.work ?? false}
                            onChange={e => handleScheduleChange(d.key as keyof StaffWeeklySchedule, 'work', e.target.checked)}
                            className="rounded text-rose-600"
                          />
                          <span>{d.label}</span>
                        </label>

                        {shift?.work ? (
                          <div className="flex items-center gap-2 flex-1">
                            <input
                              type="time"
                              value={shift.start || '10:00'}
                              onChange={e => handleScheduleChange(d.key as keyof StaffWeeklySchedule, 'start', e.target.value)}
                              className="px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-mono"
                            />
                            <span className="text-slate-400">至</span>
                            <input
                              type="time"
                              value={shift.end || '20:00'}
                              onChange={e => handleScheduleChange(d.key as keyof StaffWeeklySchedule, 'end', e.target.value)}
                              className="px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-mono"
                            />
                          </div>
                        ) : (
                          <span className="text-slate-400 text-xs py-1">公休日 (不開放預約)</span>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t">
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100"
              >
                取消
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-500 text-white shadow-xs active:scale-95 transition-all"
              >
                {isSubmitting ? '儲存中...' : '儲存人員與班表'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}
