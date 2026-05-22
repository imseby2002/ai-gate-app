'use client'
import { useState, useEffect, useCallback } from 'react'
import { ChevronLeft, ChevronRight, Plus, Trash2, Edit2, X, Zap, CalendarRange } from 'lucide-react'
import { createPortal } from 'react-dom'
import DailyPricingCalendar from './DailyPricingCalendar'

// ── Types ────────────────────────────────────────────────────
type BookingStatus = 'open' | 'closed' | 'admin_only'
type HolidayType = 'holiday' | 'winter_vacation' | 'summer_vacation'
interface HolidayPeriod { name: string; from: string; to: string; type: HolidayType }
type AdjType = 'percent' | 'fixed'
type RuleType = 'weekend' | 'holiday' | 'seasonal' | 'occupancy' | 'advance_booking' | 'early_bird'

interface Property {
  id: string; name: string; room_count: number
  base_price: number | null; currency: string; dynamic_pricing_enabled: boolean
}
interface DateSetting {
  id?: string; property_id: string; date: string
  booking_status: BookingStatus; price_override: number | null; notes?: string
}
interface PricingRule {
  id: string; property_id: string | null; name: string; rule_type: RuleType
  enabled: boolean; adjustment_type: AdjType; adjustment_value: number
  conditions: Record<string, unknown>; priority: number
}

// ── Constants ────────────────────────────────────────────────
const STATUS_CFG = {
  open:       { label: '開放', color: 'bg-emerald-100 text-emerald-700 border-emerald-300' },
  closed:     { label: '關閉', color: 'bg-red-100 text-red-700 border-red-300' },
  admin_only: { label: '後台', color: 'bg-amber-100 text-amber-700 border-amber-300' },
} as const

const RULE_TYPE_CFG: Record<RuleType, { label: string; icon: string }> = {
  weekend:         { label: '週末',              icon: '📅' },
  holiday:         { label: '假日',              icon: '🎉' },
  seasonal:        { label: '季節性',            icon: '🌸' },
  occupancy:       { label: '住房率',            icon: '📊' },
  advance_booking: { label: '臨時訂（N天內）',   icon: '⚡' },
  early_bird:      { label: '早鳥訂（N天以上）', icon: '🐦' },
}

const DOW = ['日','一','二','三','四','五','六']

// ── Helpers ──────────────────────────────────────────────────
function toDateStr(d: Date) { return d.toISOString().slice(0, 10) }
function getDaysInMonth(y: number, m: number) { return new Date(y, m + 1, 0).getDate() }

function getDateRange(from: string, to: string, dows: number[]): string[] {
  const dates: string[] = []
  const cur = new Date(from + 'T00:00:00')
  const end = new Date(to + 'T00:00:00')
  while (cur <= end) {
    if (dows.includes(cur.getDay())) dates.push(toDateStr(cur))
    cur.setDate(cur.getDate() + 1)
  }
  return dates
}

function computeEffectivePrice(
  basePrice: number | null,
  rules: PricingRule[],
  date: string,
  dynamicEnabled: boolean,
): number | null {
  if (basePrice == null) return null
  if (!dynamicEnabled) return basePrice
  const dow = new Date(date + 'T00:00:00').getDay()
  const mmdd = date.slice(5)
  let price = basePrice
  for (const rule of rules.filter(r => r.enabled).sort((a, b) => b.priority - a.priority)) {
    let applies = false
    if (rule.rule_type === 'weekend') applies = [0, 6].includes(dow)
    else if (rule.rule_type === 'holiday') applies = ((rule.conditions.dates as string[]) ?? []).includes(date)
    else if (rule.rule_type === 'seasonal') {
      const s = rule.conditions.start_mmdd as string
      const e = rule.conditions.end_mmdd as string
      applies = !!(s && e && mmdd >= s && mmdd <= e)
    }
    if (applies) {
      price = rule.adjustment_type === 'percent'
        ? price * (1 + rule.adjustment_value / 100)
        : price + rule.adjustment_value
    }
  }
  return Math.round(price)
}

// ── Page ─────────────────────────────────────────────────────
export default function PricingPage() {
  const now = new Date()
  const [tab, setTab] = useState<'daily' | 'calendar' | 'rules'>('daily')
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth())
  const [filterProp, setFilterProp] = useState('')

  const [properties, setProperties] = useState<Property[]>([])
  const [dateSettings, setDateSettings] = useState<DateSetting[]>([])
  const [rules, setRules] = useState<PricingRule[]>([])
  const [loading, setLoading] = useState(true)

  // Grid selection
  const [selectedCells, setSelectedCells] = useState<Set<string>>(new Set())
  const [pendingPrice, setPendingPrice] = useState('')
  const [showPriceInput, setShowPriceInput] = useState(false)
  const [applyingSaving, setApplyingSaving] = useState(false)

  // Batch pricing modal
  const [showBatch, setShowBatch] = useState(false)
  const [batchFrom, setBatchFrom] = useState('')
  const [batchTo, setBatchTo] = useState('')
  const [batchDow, setBatchDow] = useState<number[]>([0,1,2,3,4,5,6])
  const [batchProps, setBatchProps] = useState<string[]>([])
  const [batchPrice, setBatchPrice] = useState('')
  const [batchStatus, setBatchStatus] = useState<BookingStatus | ''>('')
  const [batchSaving, setBatchSaving] = useState(false)

  // Holiday presets
  const [holidays, setHolidays] = useState<HolidayPeriod[]>([])
  const [holidaysLoading, setHolidaysLoading] = useState(false)
  const [selectedHolidays, setSelectedHolidays] = useState<Set<string>>(new Set())

  // Rule modal
  const [ruleModal, setRuleModal] = useState<Partial<PricingRule> | null>(null)
  const [ruleSaving, setRuleSaving] = useState(false)

  const fetchData = useCallback(async () => {
    setLoading(true)
    const from = `${year}-${String(month + 1).padStart(2, '0')}-01`
    const lastDay = getDaysInMonth(year, month)
    const to = `${year}-${String(month + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`
    const [prRes, dsRes, ruRes] = await Promise.all([
      fetch('/api/booking/properties').then(r => r.json()),
      fetch(`/api/booking/pricing?from=${from}&to=${to}`).then(r => r.json()),
      fetch('/api/booking/pricing/rules').then(r => r.json()),
    ])
    setProperties((prRes.properties ?? []).filter((p: Property) => p.room_count > 0))
    setDateSettings(dsRes.settings ?? [])
    setRules(ruRes.rules ?? [])
    setLoading(false)
  }, [year, month])

  useEffect(() => { fetchData() }, [fetchData])

  useEffect(() => {
    if (!showBatch) return
    const cacheKey = `booking_holidays_${year}`
    const cached = sessionStorage.getItem(cacheKey)
    if (cached) { try { setHolidays(JSON.parse(cached)); return } catch {} }
    setHolidaysLoading(true)
    fetch(`/api/booking/holidays?year=${year}`)
      .then(r => r.json())
      .then(data => {
        const list: HolidayPeriod[] = data.holidays ?? []
        setHolidays(list)
        sessionStorage.setItem(cacheKey, JSON.stringify(list))
      })
      .catch(() => setHolidays([]))
      .finally(() => setHolidaysLoading(false))
  }, [showBatch, year])

  const settingsMap = dateSettings.reduce<Record<string, Record<string, DateSetting>>>((acc, s) => {
    if (!acc[s.date]) acc[s.date] = {}
    acc[s.date][s.property_id] = s
    return acc
  }, {})

  function getSetting(date: string, propertyId: string): DateSetting {
    return settingsMap[date]?.[propertyId] ?? { property_id: propertyId, date, booking_status: 'open', price_override: null }
  }

  function holidayKey(h: HolidayPeriod) { return `${h.name}|${h.from}` }

  function toggleHoliday(h: HolidayPeriod) {
    const key = holidayKey(h)
    setSelectedHolidays(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key); else next.add(key)
      return next
    })
  }

  function getAllSelectedDates(): string[] {
    const all = new Set<string>()
    for (const h of holidays) {
      if (selectedHolidays.has(holidayKey(h))) {
        getDateRange(h.from, h.to, batchDow).forEach(d => all.add(d))
      }
    }
    if (batchFrom && batchTo && batchFrom <= batchTo) {
      getDateRange(batchFrom, batchTo, batchDow).forEach(d => all.add(d))
    }
    return Array.from(all).sort()
  }

  function prevMonth() { if (month === 0) { setYear(y => y - 1); setMonth(11) } else setMonth(m => m - 1) }
  function nextMonth() { if (month === 11) { setYear(y => y + 1); setMonth(0) } else setMonth(m => m + 1) }

  const daysInMonth = getDaysInMonth(year, month)
  const todayStr = toDateStr(now)
  const monthName = new Date(year, month, 1).toLocaleDateString('zh-TW', { year: 'numeric', month: 'long' })
  const visibleProps = filterProp ? properties.filter(p => p.id === filterProp) : properties

  // ── Grid selection helpers ───────────────────────────────
  function dateStr(day: number) {
    return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
  }

  function toggleCell(propertyId: string, date: string) {
    const key = `${propertyId}:${date}`
    setSelectedCells(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key); else next.add(key)
      return next
    })
  }

  function toggleDateColumn(date: string) {
    const keys = visibleProps.map(p => `${p.id}:${date}`)
    setSelectedCells(prev => {
      const next = new Set(prev)
      const allSel = keys.every(k => next.has(k))
      if (allSel) keys.forEach(k => next.delete(k))
      else keys.forEach(k => next.add(k))
      return next
    })
  }

  function toggleRoomRow(propertyId: string) {
    const keys = Array.from({ length: daysInMonth }, (_, i) => `${propertyId}:${dateStr(i + 1)}`)
    setSelectedCells(prev => {
      const next = new Set(prev)
      const allSel = keys.every(k => next.has(k))
      if (allSel) keys.forEach(k => next.delete(k))
      else keys.forEach(k => next.add(k))
      return next
    })
  }

  function selectAllVisible() {
    const keys = new Set<string>()
    visibleProps.forEach(p => {
      for (let i = 1; i <= daysInMonth; i++) keys.add(`${p.id}:${dateStr(i)}`)
    })
    setSelectedCells(keys)
  }

  function clearSelection() { setSelectedCells(new Set()) }

  async function applyStatus(status: BookingStatus) {
    if (selectedCells.size === 0) return
    setApplyingSaving(true)
    try {
      const settings = Array.from(selectedCells).map(key => {
        const [propertyId, date] = key.split(':')
        return { ...getSetting(date, propertyId), property_id: propertyId, date, booking_status: status }
      })
      await fetch('/api/booking/pricing', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ settings }),
      })
      clearSelection()
      await fetchData()
    } finally { setApplyingSaving(false) }
  }

  async function applyPrice(price: number | null) {
    if (selectedCells.size === 0) return
    setApplyingSaving(true)
    try {
      const settings = Array.from(selectedCells).map(key => {
        const [propertyId, date] = key.split(':')
        return { ...getSetting(date, propertyId), property_id: propertyId, date, price_override: price }
      })
      await fetch('/api/booking/pricing', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ settings }),
      })
      clearSelection()
      await fetchData()
    } finally { setApplyingSaving(false) }
  }

  async function applyBatch() {
    const dates = getAllSelectedDates()
    if (dates.length === 0) { alert('沒有符合條件的日期'); return }
    setBatchSaving(true)
    try {
      const targetProps = batchProps.length > 0 ? batchProps : properties.map(p => p.id)

      const rangeFrom = dates[0]
      const rangeTo = dates[dates.length - 1]
      // Fetch existing settings for the full range
      const res = await fetch(`/api/booking/pricing?from=${rangeFrom}&to=${rangeTo}`).then(r => r.json())
      const exMap: Record<string, Record<string, DateSetting>> = {}
      for (const s of res.settings ?? []) {
        if (!exMap[s.date]) exMap[s.date] = {}
        exMap[s.date][s.property_id] = s
      }

      const settings: DateSetting[] = []
      for (const date of dates) {
        for (const propertyId of targetProps) {
          const ex = exMap[date]?.[propertyId] ?? { booking_status: 'open', price_override: null }
          settings.push({
            ...ex, property_id: propertyId, date,
            booking_status: (batchStatus || ex.booking_status) as BookingStatus,
            price_override: batchPrice !== '' ? parseFloat(batchPrice) : ex.price_override,
          })
        }
      }
      await fetch('/api/booking/pricing', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ settings }),
      })
      setShowBatch(false)
      setBatchFrom(''); setBatchTo(''); setBatchPrice(''); setBatchStatus(''); setBatchDow([0,1,2,3,4,5,6])
      setSelectedHolidays(new Set())
      await fetchData()
    } finally { setBatchSaving(false) }
  }

  async function toggleDynamicPricing(propertyId: string, enabled: boolean) {
    await fetch('/api/booking/properties', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: propertyId, dynamic_pricing_enabled: enabled }),
    })
    await fetchData()
  }

  async function saveRule() {
    if (!ruleModal?.name || !ruleModal.rule_type) return
    setRuleSaving(true)
    try {
      await fetch('/api/booking/pricing/rules', {
        method: ruleModal.id ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(ruleModal),
      })
      setRuleModal(null)
      await fetchData()
    } finally { setRuleSaving(false) }
  }

  async function deleteRule(id: string) {
    if (!confirm('確定刪除此規則？')) return
    await fetch(`/api/booking/pricing/rules?id=${id}`, { method: 'DELETE' })
    fetchData()
  }

  async function toggleRule(id: string, enabled: boolean) {
    await fetch('/api/booking/pricing/rules', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, enabled }),
    })
    setRules(prev => prev.map(r => r.id === id ? { ...r, enabled } : r))
  }

  const VIEW_TABS_CFG = [
    { t: 'daily'    as const, label: '每日定價' },
    { t: 'calendar' as const, label: '格狀視圖' },
    { t: 'rules'    as const, label: '定價規則' },
  ]

  function ViewSwitcher() {
    return (
      <div className="flex rounded-lg border overflow-hidden text-xs font-medium shrink-0">
        {VIEW_TABS_CFG.map(({ t, label }) => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-2.5 py-1.5 transition-colors whitespace-nowrap
              ${tab === t ? 'bg-indigo-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}>
            {label}
          </button>
        ))}
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full overflow-hidden bg-gray-50">
      {tab === 'daily' ? (
        /* ── Tab 0: 每日定價（TRAIWAN 式日曆）── */
        <DailyPricingCalendar
          year={year} month={month}
          onPrev={prevMonth} onNext={nextMonth}
          properties={properties}
          tab={tab} onTabChange={setTab}
        />
      ) : tab === 'calendar' ? (
        /* ── Tab 1: 房間 × 日期格狀視圖 ── */
        <div className="flex flex-col flex-1 overflow-hidden">

          {/* Controls */}
          <div className="bg-white border-b px-3 py-2 flex items-center gap-2 flex-wrap shrink-0">
            <ViewSwitcher />
            {properties.length > 1 && (
              <select value={filterProp} onChange={e => setFilterProp(e.target.value)}
                className="text-sm border rounded-lg px-2.5 py-1.5 focus:outline-none bg-white">
                <option value="">全部房源</option>
                {properties.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            )}
            <div className="flex items-center gap-1">
              <button onClick={prevMonth} className="p-1.5 rounded hover:bg-gray-100"><ChevronLeft className="h-4 w-4" /></button>
              <span className="text-sm font-bold px-1 min-w-[88px] text-center">{monthName}</span>
              <button onClick={nextMonth} className="p-1.5 rounded hover:bg-gray-100"><ChevronRight className="h-4 w-4" /></button>
            </div>
            <div className="flex items-center gap-1.5 ml-auto">
              {selectedCells.size > 0 && (
                <span className="text-xs text-indigo-600 font-semibold shrink-0">{selectedCells.size} 格</span>
              )}
              <button onClick={selectAllVisible}
                className="text-xs px-2.5 py-1 rounded-lg border hover:bg-gray-50 text-gray-600 whitespace-nowrap">
                全選
              </button>
              {selectedCells.size > 0 && (
                <button onClick={clearSelection}
                  className="text-xs px-2.5 py-1 rounded-lg border hover:bg-gray-50 text-gray-600 whitespace-nowrap">
                  清除
                </button>
              )}
              <button onClick={() => { setBatchProps(properties.map(p => p.id)); setShowBatch(true) }}
                className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg border border-indigo-300 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 whitespace-nowrap font-medium">
                <CalendarRange className="h-3.5 w-3.5" />
                批次定價
              </button>
            </div>
          </div>

          {/* Grid */}
          {loading ? (
            <div className="flex-1 flex items-center justify-center text-sm text-gray-400">載入中…</div>
          ) : visibleProps.length === 0 ? (
            <div className="flex-1 flex items-center justify-center text-sm text-gray-400">尚未建立房型</div>
          ) : (
            <div className="flex-1 overflow-auto">
              <table className="border-collapse" style={{ minWidth: 'max-content' }}>
                <thead className="sticky top-0 z-10">
                  <tr>
                    {/* Room column header */}
                    <th className="sticky left-0 z-20 bg-white border-b border-r px-2.5 py-2 text-left text-xs font-semibold text-gray-500 min-w-[80px]">
                      <span className="text-[10px] text-gray-400">點房名全選列</span>
                    </th>
                    {/* Date headers — click to toggle whole column */}
                    {Array.from({ length: daysInMonth }).map((_, i) => {
                      const day = i + 1
                      const ds = dateStr(day)
                      const dow = new Date(ds + 'T00:00:00').getDay()
                      const isToday = ds === todayStr
                      const isSun = dow === 0; const isSat = dow === 6
                      const colAllSel = visibleProps.length > 0 && visibleProps.every(p => selectedCells.has(`${p.id}:${ds}`))
                      return (
                        <th key={ds} onClick={() => toggleDateColumn(ds)}
                          className={`border-b border-r py-1.5 text-center font-medium cursor-pointer select-none transition-colors
                            ${colAllSel ? 'bg-sky-100' : 'bg-white hover:bg-gray-50'}`}
                          style={{ minWidth: 48 }}>
                          <div className={`text-[10px] leading-none mb-0.5 ${isSun ? 'text-red-400' : isSat ? 'text-blue-400' : 'text-gray-400'}`}>
                            {DOW[dow]}
                          </div>
                          <div className={`text-xs font-bold mx-auto w-5 h-5 flex items-center justify-center rounded-full
                            ${isToday ? 'bg-sky-500 text-white' : isSun ? 'text-red-600' : isSat ? 'text-blue-600' : 'text-gray-700'}`}>
                            {day}
                          </div>
                        </th>
                      )
                    })}
                  </tr>
                </thead>
                <tbody>
                  {visibleProps.map(p => {
                    const rowAllSel = Array.from({ length: daysInMonth }, (_, i) => `${p.id}:${dateStr(i + 1)}`).every(k => selectedCells.has(k))
                    return (
                      <tr key={p.id}>
                        {/* Room name — click to toggle whole row */}
                        <td onClick={() => toggleRoomRow(p.id)}
                          className={`sticky left-0 z-10 border-b border-r px-2.5 py-0 font-medium text-gray-700 whitespace-nowrap text-xs cursor-pointer select-none transition-colors
                            ${rowAllSel ? 'bg-sky-100' : 'bg-white hover:bg-gray-50'}`}
                          style={{ height: 44 }}>
                          <div className="truncate max-w-[110px]">{p.name}</div>
                          {p.dynamic_pricing_enabled && <span className="text-amber-500 text-[10px]">⚡動態</span>}
                        </td>
                        {/* Date cells */}
                        {Array.from({ length: daysInMonth }).map((_, i) => {
                          const day = i + 1
                          const ds = dateStr(day)
                          const cellKey = `${p.id}:${ds}`
                          const setting = getSetting(ds, p.id)
                          const status = setting.booking_status
                          const relevantRules = rules.filter(r => r.property_id == null || r.property_id === p.id)
                          const dynamicPrice = computeEffectivePrice(p.base_price, relevantRules, ds, p.dynamic_pricing_enabled)
                          const displayPrice = setting.price_override ?? dynamicPrice
                          const isSelected = selectedCells.has(cellKey)
                          const hasOverride = setting.price_override != null

                          const bg = isSelected
                            ? 'bg-sky-100'
                            : status === 'closed' ? 'bg-red-50'
                            : status === 'admin_only' ? 'bg-amber-50'
                            : 'bg-white'

                          return (
                            <td key={ds} onClick={() => toggleCell(p.id, ds)}
                              className={`border-b border-r text-center cursor-pointer select-none transition-colors
                                ${bg} ${isSelected ? 'outline outline-2 outline-sky-400 -outline-offset-1' : 'hover:brightness-[0.96]'}`}
                              style={{ minWidth: 48, height: 44, padding: '3px 2px' }}>
                              {displayPrice != null && (
                                <div className={`text-[10px] font-semibold leading-tight tabular-nums
                                  ${hasOverride ? 'text-indigo-600' : 'text-gray-500'}`}>
                                  {Number(displayPrice).toLocaleString()}
                                </div>
                              )}
                              {status !== 'open' && (
                                <div className={`text-[9px] font-bold leading-none mt-0.5
                                  ${status === 'closed' ? 'text-red-500' : 'text-amber-600'}`}>
                                  {STATUS_CFG[status].label}
                                </div>
                              )}
                            </td>
                          )
                        })}
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}

        </div>
      ) : (
        /* ── Tab 2: 動態定價規則 ── */
        <div className="flex-1 overflow-y-auto p-4 md:p-5 space-y-6">
          <div className="flex justify-end"><ViewSwitcher /></div>
          {/* Dynamic pricing toggle per property */}
          <div>
            <h2 className="font-bold text-gray-900 mb-3">動態定價開關</h2>
            {loading ? (
              <div className="text-sm text-gray-400">載入中…</div>
            ) : properties.length === 0 ? (
              <div className="text-sm text-gray-400">尚未建立房型</div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {properties.map(p => (
                  <div key={p.id} className="bg-white rounded-xl border p-4 flex items-center justify-between">
                    <div>
                      <div className="font-semibold text-sm text-gray-900">{p.name}</div>
                      <div className="text-xs text-gray-400 mt-0.5">
                        基本價 NT$ {p.base_price ? Number(p.base_price).toLocaleString() : '未設定'}
                      </div>
                      {p.dynamic_pricing_enabled && (
                        <div className="flex items-center gap-1 mt-1">
                          <Zap className="h-3 w-3 text-amber-500" />
                          <span className="text-[10px] text-amber-600 font-semibold">動態定價中</span>
                        </div>
                      )}
                    </div>
                    <button onClick={() => toggleDynamicPricing(p.id, !p.dynamic_pricing_enabled)}
                      className={`relative inline-flex w-11 h-6 rounded-full transition-colors shrink-0
                        ${p.dynamic_pricing_enabled ? 'bg-indigo-600' : 'bg-gray-200'}`}>
                      <span className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform
                        ${p.dynamic_pricing_enabled ? 'translate-x-6' : 'translate-x-1'}`} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Pricing rules */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <div>
                <h2 className="font-bold text-gray-900">定價規則</h2>
                <p className="text-xs text-gray-400 mt-0.5">規則僅對已開啟動態定價的房型生效</p>
              </div>
              <button
                onClick={() => setRuleModal({ enabled: true, adjustment_type: 'percent', adjustment_value: 0, priority: 0, conditions: {} })}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold bg-indigo-600 text-white hover:bg-indigo-700 transition-colors">
                <Plus className="h-3.5 w-3.5" />
                新增規則
              </button>
            </div>
            {loading ? (
              <div className="text-sm text-gray-400">載入中…</div>
            ) : rules.length === 0 ? (
              <div className="bg-white rounded-xl border py-12 text-center text-sm text-gray-400">
                尚無定價規則，點擊「新增規則」開始建立
              </div>
            ) : (
              <>
                {/* Mobile cards */}
                <div className="sm:hidden space-y-2">
                  {[...rules].sort((a, b) => b.priority - a.priority).map(rule => {
                    const prop = properties.find(p => p.id === rule.property_id)
                    const adj = rule.adjustment_type === 'percent'
                      ? `${rule.adjustment_value > 0 ? '+' : ''}${rule.adjustment_value}%`
                      : `${rule.adjustment_value > 0 ? '+' : ''}NT$ ${Math.abs(Number(rule.adjustment_value)).toLocaleString()}`
                    const cfg = RULE_TYPE_CFG[rule.rule_type]
                    return (
                      <div key={rule.id} className="bg-white rounded-xl border p-3.5">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="font-semibold text-sm text-gray-900 truncate">{rule.name}</div>
                            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-1">
                              <span className="text-xs text-gray-500">{cfg?.icon} {cfg?.label}</span>
                              <span className={`text-xs font-semibold ${rule.adjustment_value >= 0 ? 'text-rose-600' : 'text-emerald-600'}`}>{adj}</span>
                              <span className="text-[10px] text-gray-400">{prop ? prop.name : '全部房型'}</span>
                              <span className="text-[10px] text-gray-400">優先級 {rule.priority}</span>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <button onClick={() => toggleRule(rule.id, !rule.enabled)}
                              className={`relative inline-flex w-9 h-5 rounded-full transition-colors
                                ${rule.enabled ? 'bg-indigo-600' : 'bg-gray-200'}`}>
                              <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform
                                ${rule.enabled ? 'translate-x-[18px]' : 'translate-x-0.5'}`} />
                            </button>
                            <button onClick={() => setRuleModal(rule)} className="p-1.5 rounded hover:bg-gray-100 text-gray-500">
                              <Edit2 className="h-4 w-4" />
                            </button>
                            <button onClick={() => deleteRule(rule.id)} className="p-1.5 rounded hover:bg-red-50 text-gray-500 hover:text-red-500">
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
                {/* Desktop table */}
                <div className="hidden sm:block bg-white rounded-xl border overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 border-b">
                      <tr>
                        <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">規則名稱</th>
                        <th className="px-3 py-3 text-center text-xs font-semibold text-gray-500">類型</th>
                        <th className="px-3 py-3 text-center text-xs font-semibold text-gray-500">調整幅度</th>
                        <th className="px-3 py-3 text-center text-xs font-semibold text-gray-500">套用房型</th>
                        <th className="px-3 py-3 text-center text-xs font-semibold text-gray-500">狀態</th>
                        <th className="px-3 py-3 text-center text-xs font-semibold text-gray-500">操作</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {[...rules].sort((a, b) => b.priority - a.priority).map(rule => {
                        const prop = properties.find(p => p.id === rule.property_id)
                        const adj = rule.adjustment_type === 'percent'
                          ? `${rule.adjustment_value > 0 ? '+' : ''}${rule.adjustment_value}%`
                          : `${rule.adjustment_value > 0 ? '+' : ''}NT$ ${Math.abs(Number(rule.adjustment_value)).toLocaleString()}`
                        const cfg = RULE_TYPE_CFG[rule.rule_type]
                        return (
                          <tr key={rule.id} className="hover:bg-gray-50">
                            <td className="px-4 py-3">
                              <div className="font-medium text-gray-900">{rule.name}</div>
                              <div className="text-[10px] text-gray-400 mt-0.5">優先級 {rule.priority}</div>
                            </td>
                            <td className="px-3 py-3 text-center text-sm">{cfg?.icon} {cfg?.label}</td>
                            <td className="px-3 py-3 text-center">
                              <span className={rule.adjustment_value >= 0 ? 'text-rose-600 font-semibold' : 'text-emerald-600 font-semibold'}>{adj}</span>
                            </td>
                            <td className="px-3 py-3 text-center text-gray-600 text-xs">{prop ? prop.name : '全部房型'}</td>
                            <td className="px-3 py-3 text-center">
                              <button onClick={() => toggleRule(rule.id, !rule.enabled)}
                                className={`relative inline-flex w-9 h-5 rounded-full transition-colors ${rule.enabled ? 'bg-indigo-600' : 'bg-gray-200'}`}>
                                <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${rule.enabled ? 'translate-x-[18px]' : 'translate-x-0.5'}`} />
                              </button>
                            </td>
                            <td className="px-3 py-3 text-center">
                              <div className="flex items-center justify-center gap-1">
                                <button onClick={() => setRuleModal(rule)} className="p-1.5 rounded hover:bg-gray-100 text-gray-500"><Edit2 className="h-3.5 w-3.5" /></button>
                                <button onClick={() => deleteRule(rule.id)} className="p-1.5 rounded hover:bg-red-50 text-gray-500 hover:text-red-500"><Trash2 className="h-3.5 w-3.5" /></button>
                              </div>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Fixed action bar — appears when grid cells are selected */}
      {tab === 'calendar' && (selectedCells.size > 0 || showPriceInput) && typeof window !== 'undefined' && createPortal(
        <div className="fixed bottom-0 left-0 right-0 z-[9990] bg-white border-t shadow-2xl px-4 py-3">
          {showPriceInput ? (
            <div className="flex items-center gap-2 flex-wrap max-w-4xl mx-auto">
              <button onClick={() => { setShowPriceInput(false); setPendingPrice('') }}
                className="text-gray-400 hover:text-gray-600 font-bold text-xl leading-none shrink-0">×</button>
              <span className="text-sm font-medium text-gray-700 shrink-0">覆蓋價 NT$</span>
              <input type="number" value={pendingPrice} onChange={e => setPendingPrice(e.target.value)}
                placeholder="空白=清除覆蓋" autoFocus
                className="flex-1 min-w-0 text-sm border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-sky-300" />
              <button onClick={async () => { await applyPrice(pendingPrice ? parseFloat(pendingPrice) : null); setShowPriceInput(false); setPendingPrice('') }}
                disabled={applyingSaving}
                className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50 whitespace-nowrap">
                {applyingSaving ? '套用中…' : '套用'}
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-3 flex-wrap max-w-4xl mx-auto">
              <button onClick={clearSelection}
                className="text-gray-400 hover:text-gray-600 font-bold text-xl leading-none shrink-0">×</button>
              <span className="text-sm font-semibold text-indigo-700 shrink-0">已選 {selectedCells.size} 格</span>
              <div className="flex gap-2 flex-wrap ml-auto">
                {([
                  { status: 'open' as BookingStatus,      label: '開放訂房', cls: 'bg-emerald-600 hover:bg-emerald-700' },
                  { status: 'admin_only' as BookingStatus, label: '僅後台',   cls: 'bg-amber-500 hover:bg-amber-600' },
                  { status: 'closed' as BookingStatus,     label: '不可訂',   cls: 'bg-red-600 hover:bg-red-700' },
                ] as const).map(({ status, label, cls }) => (
                  <button key={status} onClick={() => applyStatus(status)} disabled={applyingSaving}
                    className={`px-4 py-2 rounded-lg text-white text-sm font-semibold disabled:opacity-50 ${cls}`}>
                    {label}
                  </button>
                ))}
                <button onClick={() => setShowPriceInput(true)}
                  className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700">
                  設定價格
                </button>
              </div>
            </div>
          )}
        </div>,
        document.body
      )}

      {/* Batch pricing modal */}
      {showBatch && typeof window !== 'undefined' && createPortal(
        <div className="fixed inset-0 bg-black/40 z-[9999] flex items-end sm:items-center justify-center sm:p-4"
          onClick={e => { if (e.target === e.currentTarget) { setShowBatch(false); setSelectedHolidays(new Set()) } }}>
          <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-xl w-full sm:max-w-lg p-5 space-y-4 max-h-[92dvh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-bold text-gray-900">批次設定房價</h3>
                <p className="text-xs text-gray-400 mt-0.5">可多選假期，或手動輸入日期範圍</p>
              </div>
              <button onClick={() => { setShowBatch(false); setSelectedHolidays(new Set()) }} className="p-1.5 hover:bg-gray-100 rounded-lg">
                <X className="h-4 w-4 text-gray-500" />
              </button>
            </div>

            {/* Holiday presets */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <div className="text-xs font-semibold text-gray-700">快速選取假期</div>
                {selectedHolidays.size > 0 && (
                  <span className="text-[11px] text-indigo-600 font-semibold">已選 {selectedHolidays.size} 個假期</span>
                )}
                {holidaysLoading && (
                  <span className="text-[11px] text-gray-400 animate-pulse">AI 擷取中…</span>
                )}
              </div>
              <p className="text-[11px] text-gray-400">可多選，點選後日期會自動合併</p>
              {!holidaysLoading && holidays.length === 0 && (
                <div className="text-[11px] text-gray-400">無法取得假期資料</div>
              )}
              {holidays.length > 0 && (
                <div className="space-y-2">
                  {/* 連續假期 */}
                  {holidays.filter(h => h.type === 'holiday').length > 0 && (
                    <div>
                      <div className="text-[10px] text-gray-400 mb-1">🎉 連續假期</div>
                      <div className="flex flex-wrap gap-1.5">
                        {holidays.filter(h => h.type === 'holiday').map(h => {
                          const active = selectedHolidays.has(holidayKey(h))
                          return (
                            <button key={holidayKey(h)}
                              onClick={() => toggleHoliday(h)}
                              className={`px-2.5 py-1 rounded-lg text-[11px] font-medium border transition-colors
                                ${active
                                  ? 'bg-orange-500 text-white border-orange-500'
                                  : 'bg-orange-50 text-orange-700 border-orange-200 hover:bg-orange-100'}`}>
                              {active && '✓ '}{h.name}
                              <span className="ml-1 opacity-60">{h.from.slice(5)} – {h.to.slice(5)}</span>
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  )}
                  {/* 寒假 / 暑假 */}
                  {holidays.filter(h => h.type !== 'holiday').length > 0 && (
                    <div>
                      <div className="text-[10px] text-gray-400 mb-1">🏫 學期假期</div>
                      <div className="flex flex-wrap gap-1.5">
                        {holidays.filter(h => h.type !== 'holiday').map(h => {
                          const active = selectedHolidays.has(holidayKey(h))
                          return (
                            <button key={holidayKey(h)}
                              onClick={() => toggleHoliday(h)}
                              className={`px-2.5 py-1 rounded-lg text-[11px] font-medium border transition-colors
                                ${active
                                  ? 'bg-violet-500 text-white border-violet-500'
                                  : 'bg-violet-50 text-violet-700 border-violet-200 hover:bg-violet-100'}`}>
                              {active && '✓ '}{h.name}
                              <span className="ml-1 opacity-60">{h.from.slice(5)} – {h.to.slice(5)}</span>
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Date range */}
            <div className="space-y-2">
              <div className="text-xs font-semibold text-gray-700">額外手動日期範圍（選填）</div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] text-gray-500 mb-1 block">起始日</label>
                  <input type="date" value={batchFrom} onChange={e => setBatchFrom(e.target.value)}
                    className="w-full text-sm border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-300" />
                </div>
                <div>
                  <label className="text-[11px] text-gray-500 mb-1 block">結束日</label>
                  <input type="date" value={batchTo} onChange={e => setBatchTo(e.target.value)}
                    className="w-full text-sm border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-300" />
                </div>
              </div>
              {getAllSelectedDates().length > 0 && (
                <div className="text-[11px] text-gray-400">
                  合計：<span className="text-indigo-600 font-semibold">
                    {getAllSelectedDates().length}
                  </span> 天（假期+手動日期合併，星期篩選後）
                </div>
              )}
            </div>

            {/* DOW filter */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="text-xs font-semibold text-gray-700">套用星期</div>
                <div className="flex gap-2 text-xs text-indigo-600">
                  <button onClick={() => setBatchDow([0,1,2,3,4,5,6])} className="hover:underline">全部</button>
                  <button onClick={() => setBatchDow([1,2,3,4,5])} className="hover:underline">平日</button>
                  <button onClick={() => setBatchDow([0,6])} className="hover:underline">週末</button>
                </div>
              </div>
              <div className="flex gap-1.5 flex-wrap">
                {DOW.map((d, i) => (
                  <button key={i}
                    onClick={() => setBatchDow(prev => prev.includes(i) ? prev.filter(x => x !== i) : [...prev, i])}
                    className={`w-9 h-9 rounded-full text-sm font-semibold border transition-colors
                      ${batchDow.includes(i)
                        ? (i === 0 ? 'bg-red-500 text-white border-red-500' : i === 6 ? 'bg-blue-500 text-white border-blue-500' : 'bg-indigo-600 text-white border-indigo-600')
                        : (i === 0 ? 'text-red-500 border-gray-200' : i === 6 ? 'text-blue-500 border-gray-200' : 'text-gray-600 border-gray-200 hover:bg-gray-50')
                      }`}>
                    {d}
                  </button>
                ))}
              </div>
            </div>

            {/* Room selection */}
            {properties.length > 1 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="text-xs font-semibold text-gray-700">套用房型</div>
                  <button onClick={() => setBatchProps(p => p.length === properties.length ? [] : properties.map(x => x.id))}
                    className="text-xs text-indigo-600 hover:underline">
                    {batchProps.length === properties.length ? '取消全選' : '全選'}
                  </button>
                </div>
                <div className="space-y-1.5">
                  {properties.map(p => (
                    <label key={p.id} className="flex items-center gap-2.5 cursor-pointer py-1">
                      <input type="checkbox" checked={batchProps.includes(p.id)}
                        onChange={e => setBatchProps(prev => e.target.checked ? [...prev, p.id] : prev.filter(id => id !== p.id))}
                        className="rounded border-gray-300 text-indigo-600" />
                      <span className="text-sm text-gray-700">{p.name}</span>
                      {p.base_price && <span className="text-xs text-gray-400">基本價 {Number(p.base_price).toLocaleString()}</span>}
                    </label>
                  ))}
                </div>
              </div>
            )}

            {/* Price */}
            <div className="space-y-2">
              <div className="text-xs font-semibold text-gray-700">覆蓋房價</div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-500 shrink-0">NT$</span>
                <input type="number" min="0" value={batchPrice} onChange={e => setBatchPrice(e.target.value)}
                  placeholder="空白 = 不更改"
                  className="flex-1 text-sm border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-300" />
                {batchPrice && (
                  <button onClick={() => setBatchPrice('')} className="text-gray-400 hover:text-gray-600 shrink-0">
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
              <p className="text-[11px] text-gray-400">設定後會覆蓋各日期的基本價與動態定價</p>
            </div>

            {/* Status */}
            <div className="space-y-2">
              <div className="text-xs font-semibold text-gray-700">訂購狀態（選填）</div>
              <div className="flex gap-2 flex-wrap">
                {([
                  { v: '' as const,           label: '不更改', cls: 'border-gray-200 text-gray-500 bg-white' },
                  { v: 'open' as const,        label: '開放訂房', cls: 'border-emerald-300 text-emerald-700 bg-emerald-50' },
                  { v: 'admin_only' as const,  label: '僅供後台', cls: 'border-amber-300 text-amber-700 bg-amber-50' },
                  { v: 'closed' as const,      label: '不可訂房', cls: 'border-red-300 text-red-700 bg-red-50' },
                ]).map(({ v, label, cls }) => (
                  <button key={v} onClick={() => setBatchStatus(v)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors
                      ${batchStatus === v ? 'ring-2 ring-indigo-400 ring-offset-1' : ''} ${cls}`}>
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex gap-2 pt-1">
              <button onClick={() => {
                setShowBatch(false)
                setBatchFrom(''); setBatchTo(''); setBatchPrice(''); setBatchStatus(''); setBatchDow([0,1,2,3,4,5,6])
                setSelectedHolidays(new Set())
              }}
                className="flex-1 py-2.5 rounded-xl text-sm border text-gray-600 hover:bg-gray-50">取消</button>
              <button
                onClick={applyBatch}
                disabled={getAllSelectedDates().length === 0 || (!batchPrice && !batchStatus) || batchSaving}
                className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50">
                {batchSaving ? '套用中…' : `套用 ${getAllSelectedDates().length} 天`}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Rule edit modal */}
      {ruleModal && typeof window !== 'undefined' && createPortal(
        <div className="fixed inset-0 bg-black/40 z-[9999] flex items-end sm:items-center justify-center sm:p-4"
          onClick={e => { if (e.target === e.currentTarget) setRuleModal(null) }}>
          <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-xl w-full sm:max-w-lg p-5 space-y-4 max-h-[92dvh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-gray-900">{ruleModal.id ? '編輯規則' : '新增定價規則'}</h3>
              <button onClick={() => setRuleModal(null)} className="p-1.5 hover:bg-gray-100 rounded-lg">
                <X className="h-4 w-4 text-gray-500" />
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1">規則名稱 *</label>
                <input value={ruleModal.name ?? ''} onChange={e => setRuleModal(p => ({ ...p, name: e.target.value }))}
                  placeholder="例：週末加價 20%"
                  className="w-full text-sm border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-sky-300" />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-gray-600 block mb-1">規則類型 *</label>
                  <select value={ruleModal.rule_type ?? ''} onChange={e => setRuleModal(p => ({ ...p, rule_type: e.target.value as RuleType }))}
                    className="w-full text-sm border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-sky-300">
                    <option value="">選擇類型</option>
                    {Object.entries(RULE_TYPE_CFG).map(([k, v]) => <option key={k} value={k}>{v.icon} {v.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600 block mb-1">套用房型</label>
                  <select value={ruleModal.property_id ?? ''} onChange={e => setRuleModal(p => ({ ...p, property_id: e.target.value || null }))}
                    className="w-full text-sm border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-sky-300">
                    <option value="">全部房型</option>
                    {properties.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-gray-600 block mb-1">調整方式</label>
                  <select value={ruleModal.adjustment_type ?? 'percent'} onChange={e => setRuleModal(p => ({ ...p, adjustment_type: e.target.value as AdjType }))}
                    className="w-full text-sm border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-sky-300">
                    <option value="percent">百分比 (%)</option>
                    <option value="fixed">固定金額 (NT$)</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600 block mb-1">調整值（正數加價，負數折扣）</label>
                  <input type="number" value={ruleModal.adjustment_value ?? 0}
                    onChange={e => setRuleModal(p => ({ ...p, adjustment_value: parseFloat(e.target.value) || 0 }))}
                    className="w-full text-sm border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-sky-300" />
                </div>
              </div>
              {ruleModal.rule_type === 'seasonal' && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-medium text-gray-600 block mb-1">開始月日 (MM-DD)</label>
                    <input value={(ruleModal.conditions as Record<string, string>)?.start_mmdd ?? ''}
                      onChange={e => setRuleModal(p => ({ ...p, conditions: { ...p?.conditions, start_mmdd: e.target.value } }))}
                      placeholder="07-01" className="w-full text-sm border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-sky-300" />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-600 block mb-1">結束月日 (MM-DD)</label>
                    <input value={(ruleModal.conditions as Record<string, string>)?.end_mmdd ?? ''}
                      onChange={e => setRuleModal(p => ({ ...p, conditions: { ...p?.conditions, end_mmdd: e.target.value } }))}
                      placeholder="08-31" className="w-full text-sm border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-sky-300" />
                  </div>
                </div>
              )}
              {ruleModal.rule_type === 'holiday' && (
                <div>
                  <label className="text-xs font-medium text-gray-600 block mb-1">指定日期（逗號或換行分隔，格式 YYYY-MM-DD）</label>
                  <textarea rows={4}
                    value={((ruleModal.conditions as Record<string, string[]>)?.dates ?? []).join(', ')}
                    onChange={e => {
                      const dates = e.target.value.split(/[,\n]/).map(s => s.trim()).filter(Boolean)
                      setRuleModal(p => ({ ...p, conditions: { ...p?.conditions, dates } }))
                    }}
                    placeholder="2025-01-25, 2025-01-26"
                    className="w-full text-sm border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-sky-300" />
                </div>
              )}
              {ruleModal.rule_type === 'occupancy' && (
                <div>
                  <label className="text-xs font-medium text-gray-600 block mb-1">觸發住房率門檻（0.0 ~ 1.0）</label>
                  <input type="number" step="0.05" min="0" max="1"
                    value={(ruleModal.conditions as Record<string, number>)?.threshold ?? 0.8}
                    onChange={e => setRuleModal(p => ({ ...p, conditions: { ...p?.conditions, threshold: parseFloat(e.target.value) } }))}
                    className="w-full text-sm border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-sky-300" />
                </div>
              )}
              {ruleModal.rule_type === 'advance_booking' && (
                <div>
                  <label className="text-xs font-medium text-gray-600 block mb-1">
                    ⚡ 臨時訂：入住前 N 天內訂房才觸發
                  </label>
                  <p className="text-[11px] text-gray-400 mb-1.5">
                    例：N=0 → 當天訂當天住才有效（空房最後出清）；N=7 → 7天內訂房都算
                  </p>
                  <input type="number" min="0"
                    value={(ruleModal.conditions as Record<string, number>)?.days_before ?? 7}
                    onChange={e => setRuleModal(p => ({ ...p, conditions: { ...p?.conditions, days_before: parseInt(e.target.value) } }))}
                    className="w-full text-sm border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-sky-300" />
                </div>
              )}
              {ruleModal.rule_type === 'early_bird' && (
                <div>
                  <label className="text-xs font-medium text-gray-600 block mb-1">
                    🐦 早鳥訂：入住前至少 N 天訂房才觸發
                  </label>
                  <p className="text-[11px] text-gray-400 mb-1.5">
                    例：N=90 → 90 天以前訂房才算早鳥；N=30 → 30 天以前訂都算
                  </p>
                  <input type="number" min="1"
                    value={(ruleModal.conditions as Record<string, number>)?.days_before ?? 90}
                    onChange={e => setRuleModal(p => ({ ...p, conditions: { ...p?.conditions, days_before: parseInt(e.target.value) } }))}
                    className="w-full text-sm border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-sky-300" />
                </div>
              )}
              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1">優先級（數字越大越先套用）</label>
                <input type="number" value={ruleModal.priority ?? 0}
                  onChange={e => setRuleModal(p => ({ ...p, priority: parseInt(e.target.value) || 0 }))}
                  className="w-full text-sm border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-sky-300" />
              </div>
            </div>
            <div className="flex gap-2 pt-1">
              <button onClick={() => setRuleModal(null)} className="flex-1 py-2.5 rounded-xl text-sm border text-gray-600 hover:bg-gray-50">取消</button>
              <button onClick={saveRule} disabled={!ruleModal.name || !ruleModal.rule_type || ruleSaving}
                className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50">
                {ruleSaving ? '儲存中…' : '儲存規則'}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}
