'use client'
import { useState, useEffect, useCallback } from 'react'
import { ChevronLeft, ChevronRight, Plus, Trash2, Edit2, X, CalendarRange, Zap } from 'lucide-react'
import { createPortal } from 'react-dom'

// ── Types ────────────────────────────────────────────────────
type BookingStatus = 'open' | 'closed' | 'admin_only'
type AdjType = 'percent' | 'fixed'
type RuleType = 'weekend' | 'holiday' | 'seasonal' | 'occupancy' | 'advance_booking'

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
  open:       { label: '開放', color: 'bg-emerald-100 text-emerald-700 border-emerald-300', dot: 'bg-emerald-500' },
  closed:     { label: '關閉', color: 'bg-red-100 text-red-700 border-red-300',             dot: 'bg-red-500' },
  admin_only: { label: '後台', color: 'bg-amber-100 text-amber-700 border-amber-300',       dot: 'bg-amber-500' },
} as const

const RULE_TYPE_CFG: Record<RuleType, { label: string; icon: string }> = {
  weekend:         { label: '週末',   icon: '📅' },
  holiday:         { label: '假日',   icon: '🎉' },
  seasonal:        { label: '季節性', icon: '🌸' },
  occupancy:       { label: '住房率', icon: '📊' },
  advance_booking: { label: '提前訂', icon: '⏰' },
}

const DOW = ['日','一','二','三','四','五','六']

const HOLIDAY_PRESETS = [
  { name: '春節 2025',      from: '2025-01-25', to: '2025-02-02' },
  { name: '和平紀念日 2025', from: '2025-02-28', to: '2025-03-02' },
  { name: '清明 2025',      from: '2025-04-03', to: '2025-04-06' },
  { name: '端午 2025',      from: '2025-05-30', to: '2025-06-01' },
  { name: '中秋 2025',      from: '2025-10-05', to: '2025-10-07' },
  { name: '國慶 2025',      from: '2025-10-09', to: '2025-10-10' },
  { name: '春節 2026',      from: '2026-02-15', to: '2026-02-22' },
]

// ── Helpers ──────────────────────────────────────────────────
function toDateStr(d: Date) { return d.toISOString().slice(0, 10) }
function getDaysInMonth(y: number, m: number) { return new Date(y, m + 1, 0).getDate() }
function getFirstDOW(y: number, m: number) { return new Date(y, m, 1).getDay() }

function getDatesInRange(from: string, to: string): string[] {
  const dates: string[] = []
  const cur = new Date(from + 'T00:00:00')
  const end = new Date(to + 'T00:00:00')
  while (cur <= end) { dates.push(toDateStr(cur)); cur.setDate(cur.getDate() + 1) }
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
  const [tab, setTab] = useState<'calendar' | 'rules'>('calendar')
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth())
  const [selectedDate, setSelectedDate] = useState(toDateStr(now))
  const [rangeStart, setRangeStart] = useState<string | null>(null)
  const [batchMode, setBatchMode] = useState(false)
  const [filterProp, setFilterProp] = useState('')

  const [properties, setProperties] = useState<Property[]>([])
  const [dateSettings, setDateSettings] = useState<DateSetting[]>([])
  const [rules, setRules] = useState<PricingRule[]>([])
  const [loading, setLoading] = useState(true)

  // Batch state
  const [batchFrom, setBatchFrom] = useState('')
  const [batchTo, setBatchTo] = useState('')
  const [batchDow, setBatchDow] = useState<number[]>([0, 1, 2, 3, 4, 5, 6])
  const [batchProps, setBatchProps] = useState<string[]>([])
  const [batchStatus, setBatchStatus] = useState<BookingStatus | ''>('')
  const [batchPriceType, setBatchPriceType] = useState<'none' | 'override' | 'clear'>('none')
  const [batchPriceValue, setBatchPriceValue] = useState('')
  const [batchSaving, setBatchSaving] = useState(false)

  // Day detail edit state
  const [editedSettings, setEditedSettings] = useState<Record<string, Partial<DateSetting>>>({})
  const [dayDetailSaving, setDayDetailSaving] = useState(false)

  // Rule modal state
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
    if (properties.length > 0 && batchProps.length === 0)
      setBatchProps(properties.map(p => p.id))
  }, [properties]) // eslint-disable-line react-hooks/exhaustive-deps

  // Build lookup: date → propertyId → DateSetting
  const settingsMap = dateSettings.reduce<Record<string, Record<string, DateSetting>>>((acc, s) => {
    if (!acc[s.date]) acc[s.date] = {}
    acc[s.date][s.property_id] = s
    return acc
  }, {})

  function getSetting(date: string, propertyId: string): DateSetting {
    return settingsMap[date]?.[propertyId] ?? { property_id: propertyId, date, booking_status: 'open', price_override: null }
  }

  function prevMonth() { if (month === 0) { setYear(y => y - 1); setMonth(11) } else setMonth(m => m - 1) }
  function nextMonth() { if (month === 11) { setYear(y => y + 1); setMonth(0) } else setMonth(m => m + 1) }

  const daysInMonth = getDaysInMonth(year, month)
  const firstDay = getFirstDOW(year, month)
  const todayStr = toDateStr(now)
  const monthName = new Date(year, month, 1).toLocaleDateString('zh-TW', { year: 'numeric', month: 'long' })
  const visibleProps = filterProp ? properties.filter(p => p.id === filterProp) : properties

  function getDateSummaryStatus(date: string): BookingStatus | 'mixed' {
    if (visibleProps.length === 0) return 'open'
    const statuses = visibleProps.map(p => getSetting(date, p.id).booking_status)
    const unique = [...new Set(statuses)]
    return unique.length === 1 ? unique[0] : 'mixed'
  }

  function handleCellClick(ds: string, e: React.MouseEvent) {
    if (e.shiftKey && rangeStart) {
      const from = rangeStart < ds ? rangeStart : ds
      const to = rangeStart < ds ? ds : rangeStart
      setBatchFrom(from); setBatchTo(to); setSelectedDate(ds); setBatchMode(true)
    } else {
      setSelectedDate(ds); setRangeStart(ds); setBatchMode(false); setEditedSettings({})
    }
  }

  function getEditedSetting(propertyId: string): DateSetting {
    return { ...getSetting(selectedDate, propertyId), ...editedSettings[propertyId] }
  }

  function updateEdit(propertyId: string, field: keyof DateSetting, value: unknown) {
    setEditedSettings(prev => ({ ...prev, [propertyId]: { ...prev[propertyId], [field]: value } }))
  }

  async function saveDayDetail() {
    if (Object.keys(editedSettings).length === 0) return
    setDayDetailSaving(true)
    try {
      const settingsToSave = Object.entries(editedSettings).map(([propertyId, edits]) => ({
        ...getSetting(selectedDate, propertyId), ...edits, date: selectedDate, property_id: propertyId,
      }))
      await fetch('/api/booking/pricing', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ settings: settingsToSave }),
      })
      setEditedSettings({})
      await fetchData()
    } finally { setDayDetailSaving(false) }
  }

  async function applyBatch() {
    if (!batchFrom || !batchTo) return
    setBatchSaving(true)
    try {
      const dates = getDatesInRange(batchFrom, batchTo)
        .filter(d => batchDow.includes(new Date(d + 'T00:00:00').getDay()))
      const targetProps = batchProps.length > 0 ? batchProps : properties.map(p => p.id)
      const settings = []
      for (const date of dates) {
        for (const propertyId of targetProps) {
          const entry: DateSetting = { ...getSetting(date, propertyId), property_id: propertyId, date }
          if (batchStatus) entry.booking_status = batchStatus
          if (batchPriceType === 'override' && batchPriceValue) entry.price_override = parseFloat(batchPriceValue)
          if (batchPriceType === 'clear') entry.price_override = null
          settings.push(entry)
        }
      }
      await fetch('/api/booking/pricing', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ settings }),
      })
      setBatchMode(false)
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

  const selLabel = selectedDate
    ? new Date(selectedDate + 'T00:00:00').toLocaleDateString('zh-TW', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'short' })
    : ''
  const hasEdits = Object.keys(editedSettings).length > 0
  const [mobilePanel, setMobilePanel] = useState<'calendar' | 'detail'>('calendar')

  function selectDate(ds: string, e: React.MouseEvent) {
    handleCellClick(ds, e)
    setMobilePanel('detail')
  }

  return (
    <div className="flex flex-col h-full bg-gray-50">
      {/* Tabs */}
      <div className="bg-white border-b px-5 flex items-center gap-1 shrink-0">
        {(['calendar', 'rules'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`py-3.5 px-3 text-sm font-semibold border-b-2 -mb-px transition-colors
              ${tab === t ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
            {t === 'calendar' ? '定價日曆' : <span><span className="hidden sm:inline">動態定價</span>規則</span>}
          </button>
        ))}
      </div>

      {tab === 'calendar' ? (
        /* ── Tab 1: 定價日曆 ──────────────────────────────── */
        <>
        {/* Mobile panel toggle */}
        <div className="sm:hidden flex border-b bg-white shrink-0">
          {(['calendar', 'detail'] as const).map(p => (
            <button key={p} onClick={() => setMobilePanel(p)}
              className={`flex-1 py-2.5 text-sm font-semibold transition-colors border-b-2 -mb-px
                ${mobilePanel === p ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500'}`}>
              {p === 'calendar' ? '日曆' : (batchMode ? '批次設定' : selLabel || '日期詳情')}
            </button>
          ))}
        </div>
        <div className="flex flex-1 overflow-hidden">
          {/* Left: calendar */}
          <div className={`${mobilePanel === 'calendar' ? 'flex flex-col' : 'hidden'} sm:flex sm:flex-col w-full sm:w-[400px] shrink-0 border-r bg-white overflow-y-auto`}>
            <div className="p-4 border-b space-y-3">
              <div className="flex items-center gap-2">
                {properties.length > 1 && (
                  <select value={filterProp} onChange={e => setFilterProp(e.target.value)}
                    className="flex-1 text-sm border rounded-lg px-2.5 py-1.5 focus:outline-none bg-white">
                    <option value="">全部房源</option>
                    {properties.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                )}
                <div className="flex items-center gap-1 shrink-0">
                  <button onClick={prevMonth} className="p-1.5 rounded hover:bg-gray-100"><ChevronLeft className="h-4 w-4" /></button>
                  <span className="text-sm font-bold w-28 text-center">{monthName}</span>
                  <button onClick={nextMonth} className="p-1.5 rounded hover:bg-gray-100"><ChevronRight className="h-4 w-4" /></button>
                </div>
              </div>
              <div className="flex items-center gap-4 text-xs text-gray-400">
                {(['open', 'closed', 'admin_only'] as const).map(s => (
                  <span key={s} className="flex items-center gap-1">
                    <span className={`w-2.5 h-2.5 rounded-sm ${STATUS_CFG[s].dot} opacity-60`} />
                    {STATUS_CFG[s].label}
                  </span>
                ))}
                <span className="ml-auto hidden sm:inline">Shift+點擊選範圍</span>
              </div>
            </div>

            {loading ? (
              <div className="flex-1 flex items-center justify-center text-sm text-gray-400">載入中…</div>
            ) : (
              <div className="flex-1">
                <div className="grid grid-cols-7 bg-gray-50 border-b">
                  {DOW.map(d => <div key={d} className="text-center text-xs text-gray-500 py-2 font-medium">{d}</div>)}
                </div>
                <div className="grid grid-cols-7">
                  {Array.from({ length: firstDay }).map((_, i) => (
                    <div key={`e${i}`} className="h-[72px] border-b border-r bg-gray-50/40" />
                  ))}
                  {Array.from({ length: daysInMonth }).map((_, i) => {
                    const day = i + 1
                    const ds = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
                    const col = (firstDay + i) % 7
                    const isToday = ds === todayStr
                    const isSel = ds === selectedDate
                    const status = getDateSummaryStatus(ds)
                    const overrides = visibleProps.map(p => getSetting(ds, p.id).price_override).filter(Boolean)
                    return (
                      <div key={ds} onClick={e => selectDate(ds, e)}
                        className={`h-[72px] border-b border-r p-1 cursor-pointer select-none transition-colors
                          ${isSel ? 'bg-sky-50 ring-2 ring-inset ring-sky-400'
                            : status === 'closed' ? 'bg-red-50/60 hover:bg-red-50'
                            : status === 'admin_only' ? 'bg-amber-50/60 hover:bg-amber-50'
                            : 'hover:bg-gray-50'}
                          ${col === 0 ? 'text-red-500' : col === 6 ? 'text-blue-500' : ''}`}>
                        <div className="flex items-start justify-between">
                          <span className={`text-xs font-bold w-5 h-5 flex items-center justify-center rounded-full
                            ${isToday ? 'bg-sky-500 text-white' : ''}`}>{day}</span>
                          {overrides.length > 0 && (
                            <span className="text-[9px] text-indigo-600 font-semibold leading-none">
                              {Number(overrides[0]).toLocaleString()}
                            </span>
                          )}
                        </div>
                        {!filterProp && visibleProps.length > 1 ? (
                          <div className="flex gap-0.5 mt-1 flex-wrap">
                            {visibleProps.map(p => (
                              <span key={p.id} title={p.name}
                                className={`w-1.5 h-1.5 rounded-full ${STATUS_CFG[getSetting(ds, p.id).booking_status].dot}`} />
                            ))}
                          </div>
                        ) : filterProp && status !== 'open' ? (
                          <div className={`mt-1 text-[9px] px-1 py-px rounded font-semibold inline-block
                            ${STATUS_CFG[status as BookingStatus]?.color ?? ''}`}>
                            {STATUS_CFG[status as BookingStatus]?.label}
                          </div>
                        ) : null}
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Right: day detail or batch */}
          <div className={`${mobilePanel === 'detail' ? 'flex flex-col' : 'hidden'} sm:flex sm:flex-col flex-1 overflow-y-auto`}>
            {batchMode ? (
              /* ── Batch edit ── */
              <div className="p-4 md:p-5 space-y-4 max-w-2xl w-full">
                <div className="flex items-center justify-between">
                  <h2 className="font-bold text-gray-900 text-lg">批次設定</h2>
                  <button onClick={() => setBatchMode(false)} className="p-1.5 hover:bg-gray-100 rounded-lg">
                    <X className="h-4 w-4 text-gray-500" />
                  </button>
                </div>

                {/* Holiday presets */}
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-2">
                  <div className="text-xs font-bold text-amber-800">假日快速套用</div>
                  <div className="flex flex-wrap gap-2">
                    {HOLIDAY_PRESETS.map(h => (
                      <button key={h.name} onClick={() => { setBatchFrom(h.from); setBatchTo(h.to) }}
                        className="text-xs px-2.5 py-1 bg-white border border-amber-300 rounded-lg text-amber-800 hover:bg-amber-100 transition-colors">
                        {h.name}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Date range */}
                <div className="bg-white rounded-xl border p-4 space-y-3">
                  <div className="font-semibold text-sm text-gray-900">日期範圍</div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-gray-500 mb-1 block">起始日</label>
                      <input type="date" value={batchFrom} onChange={e => setBatchFrom(e.target.value)}
                        className="w-full text-sm border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-sky-300" />
                    </div>
                    <div>
                      <label className="text-xs text-gray-500 mb-1 block">結束日</label>
                      <input type="date" value={batchTo} onChange={e => setBatchTo(e.target.value)}
                        className="w-full text-sm border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-sky-300" />
                    </div>
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 mb-2 block">套用星期</label>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {DOW.map((d, i) => (
                        <button key={i}
                          onClick={() => setBatchDow(prev => prev.includes(i) ? prev.filter(x => x !== i) : [...prev, i])}
                          className={`w-8 h-8 rounded-full text-xs font-semibold border transition-colors
                            ${batchDow.includes(i) ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'}`}>
                          {d}
                        </button>
                      ))}
                      <button onClick={() => setBatchDow([0,1,2,3,4,5,6])} className="ml-2 text-xs text-indigo-600 hover:underline">全選</button>
                      <button onClick={() => setBatchDow([0,6])} className="text-xs text-indigo-600 hover:underline">週末</button>
                      <button onClick={() => setBatchDow([1,2,3,4,5])} className="text-xs text-indigo-600 hover:underline">平日</button>
                    </div>
                  </div>
                </div>

                {/* Property selection */}
                {properties.length > 1 && (
                  <div className="bg-white rounded-xl border p-4 space-y-2">
                    <div className="font-semibold text-sm text-gray-900">套用房型</div>
                    <div className="space-y-1.5">
                      {properties.map(p => (
                        <label key={p.id} className="flex items-center gap-2 cursor-pointer">
                          <input type="checkbox" checked={batchProps.includes(p.id)}
                            onChange={e => setBatchProps(prev => e.target.checked ? [...prev, p.id] : prev.filter(id => id !== p.id))}
                            className="rounded" />
                          <span className="text-sm text-gray-700">{p.name}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}

                {/* Status + price */}
                <div className="bg-white rounded-xl border p-4 space-y-4">
                  <div>
                    <div className="font-semibold text-sm text-gray-900 mb-2">訂購狀態</div>
                    <div className="flex gap-2 flex-wrap">
                      {(['', 'open', 'closed', 'admin_only'] as const).map(s => (
                        <button key={s} onClick={() => setBatchStatus(s)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors
                            ${batchStatus === s ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'}`}>
                          {s === '' ? '不更改' : STATUS_CFG[s].label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <div className="font-semibold text-sm text-gray-900 mb-2">覆蓋訂價</div>
                    <div className="flex gap-2 flex-wrap">
                      {(['none', 'override', 'clear'] as const).map(t => (
                        <button key={t} onClick={() => setBatchPriceType(t)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors
                            ${batchPriceType === t ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'}`}>
                          {t === 'none' ? '不更改' : t === 'override' ? '設定覆蓋價' : '清除覆蓋'}
                        </button>
                      ))}
                    </div>
                    {batchPriceType === 'override' && (
                      <div className="flex items-center gap-2 mt-2">
                        <span className="text-xs text-gray-500">NT$</span>
                        <input type="number" value={batchPriceValue} onChange={e => setBatchPriceValue(e.target.value)}
                          placeholder="輸入價格" min="0"
                          className="w-36 text-sm border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-sky-300" />
                      </div>
                    )}
                  </div>
                </div>

                <button onClick={applyBatch} disabled={batchSaving || !batchFrom || !batchTo}
                  className="w-full py-3 rounded-xl font-bold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 transition-colors">
                  {batchSaving ? '套用中…' : '套用批次設定'}
                </button>
              </div>
            ) : (
              /* ── Day detail ── */
              <div className="p-4 md:p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="font-bold text-gray-900 text-lg">{selLabel}</h2>
                    <p className="text-xs text-gray-400 mt-0.5">修改狀態或覆蓋價格後按儲存</p>
                  </div>
                  <button onClick={() => { setBatchFrom(selectedDate); setBatchTo(selectedDate); setBatchMode(true) }}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold border border-indigo-300 text-indigo-700 hover:bg-indigo-50 transition-colors">
                    <CalendarRange className="h-3.5 w-3.5" />
                    批次設定
                  </button>
                </div>

                {loading ? (
                  <div className="py-10 text-center text-sm text-gray-400">載入中…</div>
                ) : visibleProps.length === 0 ? (
                  <div className="py-10 text-center text-sm text-gray-400">尚未建立房型</div>
                ) : (
                  <div className="space-y-2">
                    {/* Mobile cards */}
                    <div className="sm:hidden space-y-2">
                      {visibleProps.map(p => {
                        const setting = getEditedSetting(p.id)
                        const relevantRules = rules.filter(r => r.property_id == null || r.property_id === p.id)
                        const dynamicPrice = computeEffectivePrice(p.base_price, relevantRules, selectedDate, p.dynamic_pricing_enabled)
                        const finalPrice = setting.price_override ?? dynamicPrice
                        const isDynamic = setting.price_override == null && p.dynamic_pricing_enabled && dynamicPrice !== p.base_price
                        const isEdited = !!editedSettings[p.id]
                        return (
                          <div key={p.id} className={`bg-white rounded-xl border p-3.5 space-y-3 ${isEdited ? 'ring-2 ring-sky-400' : ''}`}>
                            <div className="flex items-center justify-between">
                              <div>
                                <div className="font-semibold text-sm text-gray-900">{p.name}</div>
                                {p.dynamic_pricing_enabled && (
                                  <div className="flex items-center gap-1 mt-0.5">
                                    <Zap className="h-3 w-3 text-amber-500" />
                                    <span className="text-[10px] text-amber-600">動態定價</span>
                                  </div>
                                )}
                              </div>
                              {finalPrice != null && (
                                <div className="text-right">
                                  <div className="font-bold text-gray-900">NT$ {Number(finalPrice).toLocaleString()}</div>
                                  {setting.price_override != null && <div className="text-[9px] text-indigo-600 font-semibold">覆蓋價</div>}
                                  {isDynamic && <div className="text-[9px] text-amber-600 font-semibold">動態</div>}
                                </div>
                              )}
                            </div>
                            <div>
                              <div className="text-[10px] text-gray-400 mb-1.5">訂購狀態</div>
                              <div className="flex gap-1.5">
                                {(['open', 'closed', 'admin_only'] as const).map(s => (
                                  <button key={s} onClick={() => updateEdit(p.id, 'booking_status', s)}
                                    className={`flex-1 py-1.5 rounded-lg text-[10px] font-semibold border transition-colors
                                      ${setting.booking_status === s ? STATUS_CFG[s].color : 'bg-white text-gray-400 border-gray-200'}`}>
                                    {STATUS_CFG[s].label}
                                  </button>
                                ))}
                              </div>
                            </div>
                            <div>
                              <div className="text-[10px] text-gray-400 mb-1.5">覆蓋訂價（基本價：{p.base_price ? `NT$ ${Number(p.base_price).toLocaleString()}` : '未設定'}）</div>
                              <div className="flex items-center gap-1.5">
                                <input type="number" min="0"
                                  value={setting.price_override ?? ''}
                                  onChange={e => updateEdit(p.id, 'price_override', e.target.value ? parseFloat(e.target.value) : null)}
                                  placeholder="使用基本價 / 動態價"
                                  className="flex-1 text-sm border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-sky-300" />
                                {setting.price_override != null && (
                                  <button onClick={() => updateEdit(p.id, 'price_override', null)}
                                    className="p-2 text-gray-400 hover:text-gray-600 shrink-0">
                                    <X className="h-4 w-4" />
                                  </button>
                                )}
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
                            <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">房型</th>
                            <th className="px-3 py-3 text-center text-xs font-semibold text-gray-500">訂購狀態</th>
                            <th className="px-3 py-3 text-center text-xs font-semibold text-gray-500">基本價</th>
                            <th className="px-3 py-3 text-center text-xs font-semibold text-gray-500">覆蓋訂價</th>
                            <th className="px-3 py-3 text-center text-xs font-semibold text-gray-500">最終價格</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y">
                          {visibleProps.map(p => {
                            const setting = getEditedSetting(p.id)
                            const relevantRules = rules.filter(r => r.property_id == null || r.property_id === p.id)
                            const dynamicPrice = computeEffectivePrice(p.base_price, relevantRules, selectedDate, p.dynamic_pricing_enabled)
                            const finalPrice = setting.price_override ?? dynamicPrice
                            const isDynamic = setting.price_override == null && p.dynamic_pricing_enabled && dynamicPrice !== p.base_price
                            const isEdited = !!editedSettings[p.id]
                            return (
                              <tr key={p.id} className={isEdited ? 'bg-sky-50/50' : 'hover:bg-gray-50'}>
                                <td className="px-4 py-3">
                                  <div className="font-medium text-gray-900">{p.name}</div>
                                  {p.dynamic_pricing_enabled && (
                                    <div className="flex items-center gap-1 mt-0.5">
                                      <Zap className="h-3 w-3 text-amber-500" />
                                      <span className="text-[10px] text-amber-600">動態定價啟用</span>
                                    </div>
                                  )}
                                </td>
                                <td className="px-3 py-3">
                                  <div className="flex gap-1 justify-center">
                                    {(['open', 'closed', 'admin_only'] as const).map(s => (
                                      <button key={s} onClick={() => updateEdit(p.id, 'booking_status', s)}
                                        className={`px-2 py-1 rounded-md text-[10px] font-semibold border transition-colors
                                          ${setting.booking_status === s ? STATUS_CFG[s].color : 'bg-white text-gray-400 border-gray-200 hover:bg-gray-50'}`}>
                                        {STATUS_CFG[s].label}
                                      </button>
                                    ))}
                                  </div>
                                </td>
                                <td className="px-3 py-3 text-center text-gray-500 text-sm">
                                  {p.base_price ? Number(p.base_price).toLocaleString() : '—'}
                                </td>
                                <td className="px-3 py-3">
                                  <div className="flex items-center gap-1 justify-center">
                                    <input type="number" min="0"
                                      value={setting.price_override ?? ''}
                                      onChange={e => updateEdit(p.id, 'price_override', e.target.value ? parseFloat(e.target.value) : null)}
                                      placeholder="—"
                                      className="w-24 text-sm border rounded-lg px-2 py-1 text-center focus:outline-none focus:ring-2 focus:ring-sky-300" />
                                    {setting.price_override != null && (
                                      <button onClick={() => updateEdit(p.id, 'price_override', null)}
                                        className="text-gray-300 hover:text-gray-500 shrink-0">
                                        <X className="h-3 w-3" />
                                      </button>
                                    )}
                                  </div>
                                </td>
                                <td className="px-3 py-3 text-center">
                                  {finalPrice != null ? (
                                    <div>
                                      <div className="font-bold text-gray-900">NT$ {Number(finalPrice).toLocaleString()}</div>
                                      {setting.price_override != null && (
                                        <div className="text-[9px] text-indigo-600 font-semibold">覆蓋</div>
                                      )}
                                      {isDynamic && (
                                        <div className="text-[9px] text-amber-600 font-semibold">動態</div>
                                      )}
                                    </div>
                                  ) : '—'}
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                    {hasEdits && (
                      <div className="bg-sky-50 border border-sky-200 rounded-xl px-4 py-3 flex items-center justify-between">
                        <span className="text-xs text-sky-700">有未儲存的修改</span>
                        <div className="flex gap-2">
                          <button onClick={() => setEditedSettings({})}
                            className="px-3 py-1.5 text-xs rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50">
                            取消
                          </button>
                          <button onClick={saveDayDetail} disabled={dayDetailSaving}
                            className="px-3 py-1.5 text-xs rounded-lg bg-indigo-600 text-white font-semibold hover:bg-indigo-700 disabled:opacity-50">
                            {dayDetailSaving ? '儲存中…' : '儲存'}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
        </>
      ) : (
        /* ── Tab 2: 動態定價規則 ──────────────────────────── */
        <div className="flex-1 overflow-y-auto p-4 md:p-5 space-y-6">
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
                            <td className="px-3 py-3 text-center text-sm">
                              {cfg?.icon} {cfg?.label}
                            </td>
                            <td className="px-3 py-3 text-center">
                              <span className={rule.adjustment_value >= 0 ? 'text-rose-600 font-semibold' : 'text-emerald-600 font-semibold'}>
                                {adj}
                              </span>
                            </td>
                            <td className="px-3 py-3 text-center text-gray-600 text-xs">
                              {prop ? prop.name : '全部房型'}
                            </td>
                            <td className="px-3 py-3 text-center">
                              <button onClick={() => toggleRule(rule.id, !rule.enabled)}
                                className={`relative inline-flex w-9 h-5 rounded-full transition-colors
                                  ${rule.enabled ? 'bg-indigo-600' : 'bg-gray-200'}`}>
                                <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform
                                  ${rule.enabled ? 'translate-x-[18px]' : 'translate-x-0.5'}`} />
                              </button>
                            </td>
                            <td className="px-3 py-3 text-center">
                              <div className="flex items-center justify-center gap-1">
                                <button onClick={() => setRuleModal(rule)}
                                  className="p-1.5 rounded hover:bg-gray-100 text-gray-500">
                                  <Edit2 className="h-3.5 w-3.5" />
                                </button>
                                <button onClick={() => deleteRule(rule.id)}
                                  className="p-1.5 rounded hover:bg-red-50 text-gray-500 hover:text-red-500">
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
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
                <input value={ruleModal.name ?? ''}
                  onChange={e => setRuleModal(p => ({ ...p, name: e.target.value }))}
                  placeholder="例：週末加價 20%"
                  className="w-full text-sm border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-sky-300" />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-gray-600 block mb-1">規則類型 *</label>
                  <select value={ruleModal.rule_type ?? ''}
                    onChange={e => setRuleModal(p => ({ ...p, rule_type: e.target.value as RuleType }))}
                    className="w-full text-sm border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-sky-300">
                    <option value="">選擇類型</option>
                    {Object.entries(RULE_TYPE_CFG).map(([k, v]) => (
                      <option key={k} value={k}>{v.icon} {v.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600 block mb-1">套用房型</label>
                  <select value={ruleModal.property_id ?? ''}
                    onChange={e => setRuleModal(p => ({ ...p, property_id: e.target.value || null }))}
                    className="w-full text-sm border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-sky-300">
                    <option value="">全部房型</option>
                    {properties.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-gray-600 block mb-1">調整方式</label>
                  <select value={ruleModal.adjustment_type ?? 'percent'}
                    onChange={e => setRuleModal(p => ({ ...p, adjustment_type: e.target.value as AdjType }))}
                    className="w-full text-sm border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-sky-300">
                    <option value="percent">百分比 (%)</option>
                    <option value="fixed">固定金額 (NT$)</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600 block mb-1">
                    調整值 {ruleModal.adjustment_type === 'percent' ? '(%)' : '(NT$)'}（正數加價，負數折扣）
                  </label>
                  <input type="number"
                    value={ruleModal.adjustment_value ?? 0}
                    onChange={e => setRuleModal(p => ({ ...p, adjustment_value: parseFloat(e.target.value) || 0 }))}
                    className="w-full text-sm border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-sky-300" />
                </div>
              </div>

              {/* Conditions by type */}
              {ruleModal.rule_type === 'seasonal' && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-medium text-gray-600 block mb-1">開始月日 (MM-DD)</label>
                    <input value={(ruleModal.conditions as Record<string, string>)?.start_mmdd ?? ''}
                      onChange={e => setRuleModal(p => ({ ...p, conditions: { ...p?.conditions, start_mmdd: e.target.value } }))}
                      placeholder="07-01"
                      className="w-full text-sm border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-sky-300" />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-600 block mb-1">結束月日 (MM-DD)</label>
                    <input value={(ruleModal.conditions as Record<string, string>)?.end_mmdd ?? ''}
                      onChange={e => setRuleModal(p => ({ ...p, conditions: { ...p?.conditions, end_mmdd: e.target.value } }))}
                      placeholder="08-31"
                      className="w-full text-sm border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-sky-300" />
                  </div>
                </div>
              )}

              {ruleModal.rule_type === 'holiday' && (
                <div>
                  <label className="text-xs font-medium text-gray-600 block mb-1">
                    指定日期（每行或逗號分隔，格式 YYYY-MM-DD）
                  </label>
                  <textarea rows={4}
                    value={((ruleModal.conditions as Record<string, string[]>)?.dates ?? []).join(', ')}
                    onChange={e => {
                      const dates = e.target.value.split(/[,\n]/).map(s => s.trim()).filter(Boolean)
                      setRuleModal(p => ({ ...p, conditions: { ...p?.conditions, dates } }))
                    }}
                    placeholder="2025-01-25, 2025-01-26, 2025-02-02"
                    className="w-full text-sm border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-sky-300" />
                </div>
              )}

              {ruleModal.rule_type === 'occupancy' && (
                <div>
                  <label className="text-xs font-medium text-gray-600 block mb-1">
                    觸發住房率門檻（0.0 ~ 1.0，例如 0.8 代表 80% 以上啟動加價）
                  </label>
                  <input type="number" step="0.05" min="0" max="1"
                    value={(ruleModal.conditions as Record<string, number>)?.threshold ?? 0.8}
                    onChange={e => setRuleModal(p => ({ ...p, conditions: { ...p?.conditions, threshold: parseFloat(e.target.value) } }))}
                    className="w-full text-sm border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-sky-300" />
                </div>
              )}

              {ruleModal.rule_type === 'advance_booking' && (
                <div>
                  <label className="text-xs font-medium text-gray-600 block mb-1">
                    入住前 N 天內訂房才觸發（例如 7 = 提前 7 天內下單）
                  </label>
                  <input type="number" min="1"
                    value={(ruleModal.conditions as Record<string, number>)?.days_before ?? 7}
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
              <button onClick={() => setRuleModal(null)}
                className="flex-1 py-2.5 rounded-xl text-sm border text-gray-600 hover:bg-gray-50">取消</button>
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
