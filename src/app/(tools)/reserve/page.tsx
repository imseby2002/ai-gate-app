'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import {
  CalendarDays, Users, DollarSign, Clock, CheckCircle2,
  AlertCircle, ChevronRight, Plus, ExternalLink, Sparkles,
  Phone, MapPin, Copy, Check, MessageSquareHeart, UserCheck,
  TrendingUp, ArrowUpRight
} from 'lucide-react'
import { ReserveStore, ReserveAppointment, ReserveStaff, ReserveService } from '@/lib/reserve/types'
import { DEFAULT_STORE, DEFAULT_STAFF, DEFAULT_SERVICES, generateInitialAppointments } from '@/lib/reserve/mock-data'
import { cn } from '@/lib/utils/cn'

export default function ReserveDashboard() {
  const [store, setStore] = useState<ReserveStore>(DEFAULT_STORE)
  const [appointments, setAppointments] = useState<ReserveAppointment[]>([])
  const [staffList, setStaffList] = useState<ReserveStaff[]>(DEFAULT_STAFF)
  const [services, setServices] = useState<ReserveService[]>(DEFAULT_SERVICES)
  const [loading, setLoading] = useState(true)
  const [copiedLink, setCopiedLink] = useState(false)
  const [quickConfirmId, setQuickConfirmId] = useState<string | null>(null)

  const todayStr = new Date().toISOString().slice(0, 10)

  useEffect(() => {
    async function loadData() {
      try {
        const [storeRes, apptRes, staffRes, srvRes] = await Promise.all([
          fetch('/api/reserve/store').then(r => r.json()).catch(() => ({ store: DEFAULT_STORE })),
          fetch('/api/reserve/appointments').then(r => r.json()).catch(() => ({ appointments: generateInitialAppointments(todayStr) })),
          fetch('/api/reserve/staff').then(r => r.json()).catch(() => ({ staff: DEFAULT_STAFF })),
          fetch('/api/reserve/services').then(r => r.json()).catch(() => ({ services: DEFAULT_SERVICES })),
        ])
        if (storeRes.store) setStore(storeRes.store)
        if (apptRes.appointments) setAppointments(apptRes.appointments)
        if (staffRes.staff) setStaffList(staffRes.staff)
        if (srvRes.services) setServices(srvRes.services)
      } catch (e) {
        console.error(e)
      } finally {
        setLoading(false)
      }
    }
    loadData()
  }, [todayStr])

  // Filter today's appointments
  const todayAppts = appointments.filter(a => {
    return a.start_time.startsWith(todayStr) && a.status !== 'cancelled'
  })

  const pendingAppts = appointments.filter(a => a.status === 'pending')
  const completedAppts = appointments.filter(a => a.status === 'completed')

  const todayEstimatedRevenue = todayAppts.reduce((sum, a) => sum + (a.total_price || 0), 0)

  async function handleStatusChange(id: string, newStatus: string) {
    setQuickConfirmId(id)
    try {
      await fetch('/api/reserve/appointments', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status: newStatus }),
      })
      setAppointments(prev =>
        prev.map(a => (a.id === id ? { ...a, status: newStatus as any } : a))
      )
    } catch (e) {
      console.error(e)
    } finally {
      setQuickConfirmId(null)
    }
  }

  function copyPublicLink() {
    const url = `${window.location.origin}/r/${store.slug || 'demo'}`
    navigator.clipboard.writeText(url)
    setCopiedLink(true)
    setTimeout(() => setCopiedLink(false), 2000)
  }

  const categoryNameMap: Record<string, string> = {
    beauty: '美膚管理 / 醫美美睫',
    hair: '美髮沙龍 / 造型設計',
    clinic: '診所看診 / 物理治療',
    spa: '精油 SPA / 舒壓按摩',
    fitness: '私人教練 / 皮拉提斯',
    pet: '寵物美容 / 毛孩沙龍',
    consulting: '法律稅務 / 商業顧問',
    auto: '汽車美容 / 鍍膜工藝',
    other: '專業綜合預約中心',
  }

  const [applyingTemplate, setApplyingTemplate] = useState<string | null>(null)
  const [templateSuccess, setTemplateSuccess] = useState<string | null>(null)

  async function handleApplyTemplate(templateKey: string) {
    if (!confirm(`確定要套用此行業模板嗎？系統將為您自動設定該行業的門市資訊、專屬服務項目與人員排班！`)) return
    setApplyingTemplate(templateKey)
    setTemplateSuccess(null)
    try {
      const res = await fetch('/api/reserve/template/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ templateKey }),
      })
      const data = await res.json()
      if (data.success && data.store) {
        setStore(data.store)
        setTemplateSuccess(data.message || '模板套用成功！')
        // Reload services & staff
        const [srvRes, staffRes] = await Promise.all([
          fetch('/api/reserve/services').then(r => r.json()).catch(() => ({})),
          fetch('/api/reserve/staff').then(r => r.json()).catch(() => ({})),
        ])
        if (srvRes.services) setServices(srvRes.services)
        if (staffRes.staff) setStaffList(staffRes.staff)
        setTimeout(() => setTemplateSuccess(null), 4000)
      } else {
        alert(data.error || '套用失敗')
      }
    } catch (e: any) {
      alert(e.message || '套用失敗')
    } finally {
      setApplyingTemplate(null)
    }
  }

  const INDUSTRY_OPTIONS = [
    { key: 'clinic', name: '醫療門診 / 物理治療', icon: '🏥', desc: '醫師初診、徒手復健、中醫針灸' },
    { key: 'hair', name: '美髮沙龍 / 造型工作室', icon: '✂️', desc: '日系剪髮、燙髮、歐美手刷染' },
    { key: 'beauty', name: '美業 / 美甲美睫 / 膚況', icon: '💅', desc: '水光管理、光療美甲、空氣感睫毛' },
    { key: 'fitness', name: '私人教練 / 體適能健身', icon: '🏋️', desc: '一對一重訓、皮拉提斯核心床' },
    { key: 'pet', name: '寵物美容 / 毛孩沙龍', icon: '🐶', desc: '草本洗護、萌系大修造型、清耳剪指甲' },
    { key: 'consulting', name: '專業顧問 / 法律會計', icon: '⚖️', desc: '專案律師諮詢、商業合約審閱' },
    { key: 'auto', name: '汽車美容 / 鍍膜工藝', icon: '🚗', desc: '手工洗車、石墨烯雙層鍍膜施工' },
  ]

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      {/* 1-Click Industry Template Setup Banner */}
      <div className="p-5 sm:p-6 rounded-3xl bg-white dark:bg-slate-900 border border-rose-200/80 dark:border-rose-900/40 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-rose-50 text-rose-600 dark:bg-rose-950/60 dark:text-rose-300 text-[11px] font-bold mb-1">
              <Sparkles className="h-3 w-3" />
              新手極速設定 · 一鍵套用行業模板
            </div>
            <h2 className="text-base font-extrabold text-slate-900 dark:text-white">
              您的店面屬於哪個行業？點擊直接載入全套專屬範本
            </h2>
            <p className="text-xs text-slate-500">
              免除繁雜手動輸入，一鍵自動建置專屬門市資料、服務項目清單、人員排班與專業用語，套用後可隨時在後台自由微調！
            </p>
          </div>
          <Link
            href="/reserve/settings"
            className="text-xs font-bold text-rose-600 hover:text-rose-500 flex items-center gap-1 shrink-0"
          >
            完全手動自訂 <ChevronRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        {templateSuccess && (
          <div className="p-3 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 text-emerald-800 dark:text-emerald-200 text-xs font-bold flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            {templateSuccess}
          </div>
        )}

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5">
          {INDUSTRY_OPTIONS.map(opt => {
            const isCurrent = store.category === opt.key
            const isProcessing = applyingTemplate === opt.key
            return (
              <button
                key={opt.key}
                disabled={applyingTemplate !== null}
                onClick={() => handleApplyTemplate(opt.key)}
                className={cn(
                  'p-3.5 rounded-2xl border text-left transition-all relative flex flex-col justify-between gap-2 group',
                  isCurrent
                    ? 'border-rose-600 bg-rose-50/40 dark:bg-rose-950/20 ring-2 ring-rose-600/20'
                    : 'border-slate-200 dark:border-slate-800 hover:border-rose-300 bg-slate-50/50 dark:bg-slate-800/30 hover:bg-white'
                )}
              >
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xl">{opt.icon}</span>
                    {isCurrent && (
                      <span className="text-[10px] font-bold text-rose-600 bg-rose-100 dark:bg-rose-950 px-2 py-0.5 rounded-full">
                        當前使用中
                      </span>
                    )}
                  </div>
                  <h3 className="font-bold text-xs text-slate-900 dark:text-white group-hover:text-rose-600 transition-colors">
                    {opt.name}
                  </h3>
                  <p className="text-[11px] text-slate-400 line-clamp-1 mt-0.5">
                    {opt.desc}
                  </p>
                </div>

                <div className="pt-1 border-t border-slate-100 dark:border-slate-800/60 flex items-center justify-between text-[11px] font-semibold text-rose-600">
                  <span>{isProcessing ? '套用中...' : '一鍵套用'}</span>
                  <ArrowUpRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                </div>
              </button>
            )
          })}
        </div>
      </div>

      {/* Hero Store Profile Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-rose-900 via-slate-900 to-slate-950 text-white p-6 sm:p-8 shadow-xl shadow-rose-950/10">
        <div className="absolute top-0 right-0 -mt-10 -mr-10 w-96 h-96 bg-rose-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-rose-500/20 text-rose-300 text-xs font-semibold backdrop-blur-md border border-rose-500/30">
              <Sparkles className="h-3.5 w-3.5" />
              {categoryNameMap[store.category] || '專業服務預約系統'}
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
              {store.name}
            </h1>
            <p className="text-sm text-slate-300 max-w-2xl line-clamp-2">
              {store.description || '提供專屬線上快速預約與 AI 智慧排程管理，支援診所、美髮、美容美甲與各類服務業。'}
            </p>
            <div className="flex flex-wrap items-center gap-4 text-xs text-slate-400 pt-1">
              <span className="flex items-center gap-1.5">
                <Phone className="h-3.5 w-3.5 text-rose-400" />
                {store.phone || '02-2712-8899'}
              </span>
              <span className="flex items-center gap-1.5">
                <MapPin className="h-3.5 w-3.5 text-rose-400" />
                {store.address || '台北市大安區忠孝東路四段 181 巷'}
              </span>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="flex flex-wrap sm:flex-col gap-2.5 shrink-0">
            <button
              onClick={copyPublicLink}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-semibold backdrop-blur-md border border-white/15 transition-all shadow-sm active:scale-95"
            >
              {copiedLink ? <Check className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4 text-rose-400" />}
              {copiedLink ? '已複製前台預約網址' : '複製公開預約網址'}
            </button>
            <Link
              href={`/r/${store.slug || 'demo'}`}
              target="_blank"
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition-all shadow-md shadow-rose-900/30 active:scale-95"
            >
              <ExternalLink className="h-4 w-4" />
              預覽顧客線上預約
            </Link>
          </div>
        </div>
      </div>

      {/* Multi-Industry Quick Preset Showcase */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs">
        <span className="text-slate-400 font-semibold shrink-0">行業前台預覽：</span>
        <Link
          href="/r/clinic-demo"
          target="_blank"
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-rose-400 text-slate-700 dark:text-slate-200 font-medium whitespace-nowrap shadow-xs"
        >
          <span>🏥 醫療診所/物理治療</span>
          <ExternalLink className="h-3 w-3 text-slate-400" />
        </Link>
        <Link
          href="/r/hair-demo"
          target="_blank"
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-rose-400 text-slate-700 dark:text-slate-200 font-medium whitespace-nowrap shadow-xs"
        >
          <span>✂️ 美髮沙龍/造型設計</span>
          <ExternalLink className="h-3 w-3 text-slate-400" />
        </Link>
        <Link
          href="/r/demo"
          target="_blank"
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-rose-400 text-slate-700 dark:text-slate-200 font-medium whitespace-nowrap shadow-xs"
        >
          <span>✨ 綜合專業服務預約</span>
          <ExternalLink className="h-3 w-3 text-slate-400" />
        </Link>
      </div>

      {/* KPI Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-medium text-slate-500">今日預約數</span>
            <div className="h-8 w-8 rounded-xl bg-rose-50 dark:bg-rose-950/50 flex items-center justify-center text-rose-600">
              <CalendarDays className="h-4 w-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-slate-900 dark:text-white tabular-nums">
            {todayAppts.length} <span className="text-xs font-normal text-slate-400">組</span>
          </div>
          <div className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium mt-1 flex items-center gap-1">
            <TrendingUp className="h-3 w-3" />
            已達標 85% 滿檔率
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-medium text-slate-500">今日預估營業額</span>
            <div className="h-8 w-8 rounded-xl bg-amber-50 dark:bg-amber-950/50 flex items-center justify-center text-amber-600">
              <DollarSign className="h-4 w-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-slate-900 dark:text-white tabular-nums">
            NT$ {todayEstimatedRevenue.toLocaleString()}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            平均客單 NT$ {todayAppts.length ? Math.round(todayEstimatedRevenue / todayAppts.length).toLocaleString() : 0}
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-medium text-slate-500">待確認預約</span>
            <div className="h-8 w-8 rounded-xl bg-orange-50 dark:bg-orange-950/50 flex items-center justify-center text-orange-600">
              <AlertCircle className="h-4 w-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-slate-900 dark:text-white tabular-nums">
            {pendingAppts.length} <span className="text-xs font-normal text-slate-400">筆</span>
          </div>
          <div className="text-[11px] text-orange-600 dark:text-orange-400 font-medium mt-1">
            {pendingAppts.length > 0 ? '建議盡快完成排程確認' : '所有預約均已確認'}
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-medium text-slate-500">在職服務人員</span>
            <div className="h-8 w-8 rounded-xl bg-blue-50 dark:bg-blue-950/50 flex items-center justify-center text-blue-600">
              <Users className="h-4 w-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-slate-900 dark:text-white tabular-nums">
            {staffList.filter(s => s.is_active).length} <span className="text-xs font-normal text-slate-400">位設計師/技師</span>
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            共提供 {services.filter(s => s.is_active).length} 項客製化服務
          </div>
        </div>
      </div>

      {/* Main Grid: Today's Timeline & AI Assist Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Today's Schedule Timeline */}
        <div className="lg:col-span-2 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/80 dark:border-slate-800 p-5 sm:p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
            <div>
              <h2 className="text-base font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                <Clock className="h-4 w-4 text-rose-600" />
                今日預約動態
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                {todayStr} 即時服務行程與到店狀態
              </p>
            </div>
            <Link
              href="/reserve/calendar"
              className="text-xs font-semibold text-rose-600 hover:text-rose-700 flex items-center gap-1"
            >
              開啟全日曆 <ChevronRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          {todayAppts.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <CalendarDays className="h-10 w-10 mx-auto text-slate-300 dark:text-slate-700 mb-2" />
              <p className="text-sm">今日尚無預約安排</p>
              <Link
                href="/reserve/appointments"
                className="inline-flex items-center gap-1.5 text-xs text-rose-600 font-semibold mt-3 hover:underline"
              >
                <Plus className="h-3.5 w-3.5" /> 手動新增第一筆預約
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {todayAppts.map(apt => {
                const startTime = apt.start_time.slice(11, 16)
                const endTime = apt.end_time.slice(11, 16)
                const staffObj = staffList.find(s => s.id === apt.staff_id)
                const serviceObj = services.find(s => s.id === apt.service_id)

                const statusStyles: Record<string, { bg: string; text: string; label: string }> = {
                  pending: { bg: 'bg-amber-50 text-amber-700 border-amber-200', text: 'text-amber-700', label: '待確認' },
                  confirmed: { bg: 'bg-blue-50 text-blue-700 border-blue-200', text: 'text-blue-700', label: '已確認' },
                  in_progress: { bg: 'bg-rose-50 text-rose-700 border-rose-200', text: 'text-rose-700', label: '服務中' },
                  completed: { bg: 'bg-emerald-50 text-emerald-700 border-emerald-200', text: 'text-emerald-700', label: '已完成' },
                  cancelled: { bg: 'bg-slate-100 text-slate-500 border-slate-200', text: 'text-slate-500', label: '已取消' },
                }

                const style = statusStyles[apt.status] || statusStyles.confirmed

                return (
                  <div
                    key={apt.id}
                    className="flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-2xl border border-slate-100 dark:border-slate-800 hover:border-rose-200 dark:hover:border-rose-900 hover:bg-rose-50/20 dark:hover:bg-rose-950/10 transition-all gap-4"
                  >
                    <div className="flex items-start gap-3.5">
                      {/* Time pill */}
                      <div className="shrink-0 text-center px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800">
                        <div className="text-sm font-bold text-slate-900 dark:text-slate-100 tabular-nums">
                          {startTime}
                        </div>
                        <div className="text-[10px] text-slate-400 tabular-nums">
                          ~ {endTime}
                        </div>
                      </div>

                      {/* Content */}
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-sm text-slate-900 dark:text-white">
                            {apt.customer_name}
                          </span>
                          <span className="text-xs text-slate-400 tabular-nums">
                            {apt.customer_phone}
                          </span>
                          <span className={cn('text-[11px] px-2 py-0.5 rounded-full border font-medium', style.bg)}>
                            {style.label}
                          </span>
                        </div>
                        <div className="text-xs text-rose-600 font-medium">
                          {apt.service?.name || serviceObj?.name || '專屬美容造型療程'}
                        </div>
                        <div className="text-[11px] text-slate-500 flex items-center gap-2">
                          <span>指定：{staffObj?.name || '門市安排 (不指定)'}</span>
                          <span>•</span>
                          <span className="font-semibold text-slate-700 dark:text-slate-300">
                            NT$ {apt.total_price.toLocaleString()}
                          </span>
                          {apt.payment_status === 'deposit_paid' && (
                            <span className="text-[10px] text-amber-600 bg-amber-50 px-1.5 py-0.2 rounded">已付定金</span>
                          )}
                        </div>
                        {apt.customer_notes && (
                          <div className="text-[11px] text-slate-400 bg-slate-50 dark:bg-slate-800/50 p-1.5 rounded-lg">
                            備註：{apt.customer_notes}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 self-end sm:self-center">
                      {apt.status === 'pending' && (
                        <button
                          disabled={quickConfirmId === apt.id}
                          onClick={() => handleStatusChange(apt.id, 'confirmed')}
                          className="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-xs transition-all"
                        >
                          確認預約
                        </button>
                      )}
                      {apt.status === 'confirmed' && (
                        <button
                          disabled={quickConfirmId === apt.id}
                          onClick={() => handleStatusChange(apt.id, 'in_progress')}
                          className="px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold shadow-xs transition-all"
                        >
                          顧客已到店
                        </button>
                      )}
                      {apt.status === 'in_progress' && (
                        <button
                          disabled={quickConfirmId === apt.id}
                          onClick={() => handleStatusChange(apt.id, 'completed')}
                          className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-xs transition-all"
                        >
                          結帳完成
                        </button>
                      )}
                      <Link
                        href={`/reserve/appointments?q=${encodeURIComponent(apt.customer_name)}`}
                        className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
                      >
                        詳情
                      </Link>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Right Col: AI Assistant & Staff Load */}
        <div className="space-y-6">
          {/* AI Insights Card */}
          <div className="bg-gradient-to-br from-rose-50 via-pink-50/40 to-white dark:from-slate-900 dark:via-rose-950/20 dark:to-slate-900 rounded-3xl border border-rose-200/80 dark:border-rose-900/40 p-5 sm:p-6 shadow-xs space-y-4">
            <div className="flex items-center gap-2.5">
              <div className="h-8 w-8 rounded-xl bg-gradient-to-r from-pink-500 to-rose-600 flex items-center justify-center text-white shadow-xs">
                <Sparkles className="h-4 w-4" />
              </div>
              <div>
                <h3 className="font-bold text-sm text-slate-900 dark:text-white">AI 智能排程與回訪</h3>
                <p className="text-[11px] text-muted-foreground">自動分析客況與貼心關懷</p>
              </div>
            </div>

            <div className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-xs p-3.5 rounded-2xl border border-rose-100 dark:border-rose-900/50 space-y-2 text-xs">
              <div className="flex items-center gap-2 font-semibold text-rose-800 dark:text-rose-300">
                <MessageSquareHeart className="h-4 w-4 text-rose-500" />
                染燙與美膚術後自動關懷
              </div>
              <p className="text-slate-600 dark:text-slate-400 text-[11px] leading-relaxed">
                系統已自動為完成水飛梭與日系燙髮的顧客生成 2 則術後護理叮嚀，預計於服務後第 2 天透過 LINE 自動推送。
              </p>
              <Link
                href="/reserve/ai-assistant"
                className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-600 hover:underline pt-1"
              >
                查看 AI 文案庫 <ArrowUpRight className="h-3 w-3" />
              </Link>
            </div>

            <div className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-xs p-3.5 rounded-2xl border border-rose-100 dark:border-rose-900/50 space-y-2 text-xs">
              <div className="flex items-center gap-2 font-semibold text-slate-800 dark:text-slate-200">
                <TrendingUp className="h-4 w-4 text-amber-500" />
                平日離峰產能補位建議
              </div>
              <p className="text-slate-600 dark:text-slate-400 text-[11px] leading-relaxed">
                週二至週四午前尚有 30% 閒置空檔，建議針對 VIP 會員發送「平日美甲/洗護 85 折」專屬補位通知。
              </p>
            </div>
          </div>

          {/* Staff Today Overview */}
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/80 dark:border-slate-800 p-5 sm:p-6 shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                <Users className="h-4 w-4 text-blue-600" />
                今日技師出勤狀態
              </h3>
              <Link href="/reserve/staff" className="text-xs text-rose-600 font-semibold hover:underline">
                班表管理
              </Link>
            </div>

            <div className="space-y-3 pt-1">
              {staffList.map(s => {
                const count = todayAppts.filter(a => a.staff_id === s.id).length
                const pct = Math.min(100, Math.round((count / 4) * 100))
                return (
                  <div key={s.id} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2 font-medium text-slate-700 dark:text-slate-300">
                        <div className="h-6 w-6 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center font-bold text-[10px] text-slate-600">
                          {s.name[0]}
                        </div>
                        {s.name}
                        <span className="text-[10px] text-slate-400">{s.title}</span>
                      </div>
                      <span className="font-semibold tabular-nums text-slate-600 dark:text-slate-400">
                        {count} 組預約
                      </span>
                    </div>
                    <div className="h-1.5 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                      <div
                        className={cn(
                          'h-full rounded-full transition-all',
                          pct > 75 ? 'bg-rose-500' : pct > 40 ? 'bg-amber-500' : 'bg-blue-500'
                        )}
                        style={{ width: `${Math.max(15, pct)}%` }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
