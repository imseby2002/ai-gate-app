'use client'
import { useState, useEffect, useCallback, useRef } from 'react'
import { useTranslations, useLocale } from 'next-intl'
import { ChevronLeft, ChevronRight, Plus, Trash2, Edit2, X, Zap, CalendarRange } from 'lucide-react'
import { createPortal } from 'react-dom'
import DailyPricingCalendar from './DailyPricingCalendar'

// ── Types ────────────────────────────────────────────────────
type BookingStatus = 'open' | 'closed' | 'admin_only'
type HolidayType = 'holiday' | 'winter_vacation' | 'summer_vacation'
interface HolidayPeriod { name: string; from: string; to: string; type: HolidayType }
type AdjType = 'percent' | 'fixed'
type RuleType = 'weekend' | 'holiday' | 'seasonal' | 'occupancy' | 'advance_booking' | 'early_bird' | 'market'

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
const STATUS_KEY: Record<BookingStatus, string> = {
  open: 'pricing.statusOpen', closed: 'pricing.statusClosed', admin_only: 'pricing.statusAdmin',
}

const RULE_TYPE_ICON: Record<RuleType, string> = {
  weekend: '📅', holiday: '🎉', seasonal: '🌸', occupancy: '📊',
  advance_booking: '⚡', early_bird: '🐦', market: '📈',
}

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
  const t = useTranslations('Booking')
  const locale = useLocale()
  const DOW = [0,1,2,3,4,5,6].map(i => t(`roomgrid.day.${i}`))
  const statusLabel = (s: BookingStatus) => t(STATUS_KEY[s])
  const ruleCfg = (type: RuleType) => ({ icon: RULE_TYPE_ICON[type], label: t(`pricing.ruleTypes.${type}`) })
  const now = new Date()
  const [tab, setTab] = useState<'daily' | 'calendar' | 'rules' | 'compare'>('daily')
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

  // 周邊比價（SerpApi Google Hotels）
  const [cmpLocation, setCmpLocation] = useState('')
  const [cmpCheckIn, setCmpCheckIn] = useState(toDateStr(now))
  const [cmpCheckOut, setCmpCheckOut] = useState(toDateStr(new Date(now.getTime() + 86400000)))
  const [cmpItems, setCmpItems] = useState<{ name: string; type: string | null; price: number | null; rating: number | null; reviews: number | null }[]>([])
  const [cmpStats, setCmpStats] = useState<{ count: number; min: number; max: number; avg: number; median: number } | null>(null)
  const [cmpLoading, setCmpLoading] = useState(false)
  const [cmpErr, setCmpErr] = useState<string | null>(null)
  const [cmpQueried, setCmpQueried] = useState(false)
  const [cmpFromCache, setCmpFromCache] = useState(false)
  // 前端 session 快取：同地區+同日期不重複打 SerpApi，省額度。
  const cmpCache = useRef<Map<string, { items: typeof cmpItems; stats: typeof cmpStats }>>(new Map())

  // 關注競品清單（指定要特別盯的飯店/民宿名稱）
  const [watchlist, setWatchlist] = useState<string[]>([])
  const [watchInput, setWatchInput] = useState('')
  const [watchPrices, setWatchPrices] = useState<Record<string, { price: number | null; rating: number | null } | null>>({})
  const [watchQuerying, setWatchQuerying] = useState<string | null>(null)

  // 自動帶入民宿所在地（縣市+地址）作為預設查詢地區，並載入關注競品清單。
  useEffect(() => {
    fetch('/api/booking/profile').then(r => r.json()).then(d => {
      const p = d.profile
      if (!p) return
      const loc = [p.city, p.address].filter(Boolean).join(' ').trim()
      if (loc) setCmpLocation(prev => prev || loc)
      if (Array.isArray(p.competitor_watchlist)) setWatchlist(p.competitor_watchlist as string[])
    }).catch(() => {})
  }, [])

  async function saveWatchlist(next: string[]) {
    setWatchlist(next)
    fetch('/api/booking/profile', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ competitor_watchlist: next }),
    }).catch(() => {})
  }
  function addWatch() {
    const v = watchInput.trim()
    if (!v || watchlist.includes(v)) { setWatchInput(''); return }
    saveWatchlist([...watchlist, v]); setWatchInput('')
  }
  function removeWatch(name: string) {
    saveWatchlist(watchlist.filter(n => n !== name))
    setWatchPrices(prev => { const c = { ...prev }; delete c[name]; return c })
  }
  function nameMatches(a: string, b: string) {
    const x = a.toLowerCase(), y = b.toLowerCase()
    return x.includes(y) || y.includes(x)
  }
  function isWatched(itemName: string) {
    return watchlist.some(w => nameMatches(itemName, w))
  }
  // 周邊清單沒涵蓋的關注競品，單獨精準查一次（耗 1 額度，有後端快取）
  async function queryWatch(name: string) {
    setWatchQuerying(name)
    try {
      const res = await fetch('/api/booking/pricing/compare', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ location: `${name} ${cmpLocation.trim()}`.trim(), check_in: cmpCheckIn, check_out: cmpCheckOut }),
      })
      const d = await res.json()
      const items: { name: string; price: number | null; rating: number | null }[] = d.items ?? []
      const hit = items.find(it => nameMatches(it.name, name))
      setWatchPrices(prev => ({ ...prev, [name]: hit ? { price: hit.price, rating: hit.rating } : null }))
    } catch {
      setWatchPrices(prev => ({ ...prev, [name]: null }))
    } finally { setWatchQuerying(null) }
  }

  // 方案A：以本次行情為基準，加減幅度後寫入每日定價（人工審核套用）
  const [applyBasis, setApplyBasis] = useState<'median' | 'min' | 'avg'>('median')
  const [applyOffset, setApplyOffset] = useState('-5')
  const [applyProps, setApplyProps] = useState<string[]>([])
  const [applyFrom, setApplyFrom] = useState('')
  const [applyTo, setApplyTo] = useState('')
  const [applyDow, setApplyDow] = useState<number[]>([0, 1, 2, 3, 4, 5, 6])
  const [applySaving, setApplySaving] = useState(false)
  const [applyMsg, setApplyMsg] = useState<string | null>(null)

  function previewApplyPrice(): number | null {
    if (!cmpStats) return null
    const base = cmpStats[applyBasis]
    return Math.round(base * (1 + (parseFloat(applyOffset) || 0) / 100))
  }

  async function applyToPricing() {
    if (!cmpStats) return
    const targets = applyProps.length ? applyProps : properties.map(p => p.id)
    if (!targets.length) { setApplyMsg(t('pricing.applyNoProps')); return }
    if (!applyFrom || !applyTo || applyFrom > applyTo) { setApplyMsg(t('pricing.applyInvalidRange')); return }
    const adjusted = previewApplyPrice()
    if (adjusted == null) return
    const dates = getDateRange(applyFrom, applyTo, applyDow)
    if (!dates.length) { setApplyMsg(t('pricing.applyNoDates')); return }
    setApplySaving(true); setApplyMsg(null)
    try {
      // 先抓區間內既有設定，套用時只覆蓋價格，保留 booking_status / 押金 / 加床等欄位
      const exRes = await fetch(`/api/booking/pricing?from=${applyFrom}&to=${applyTo}`)
      const exD = await exRes.json()
      const exMap = new Map<string, {
        booking_status?: string; deposit?: number | null; notes?: string | null
        extra_person_fee?: number | null; extra_large_bed?: number | null; extra_small_bed?: number | null
      }>()
      for (const s of exD.settings ?? []) exMap.set(`${s.property_id}:${s.date}`, s)
      const settings = targets.flatMap(pid => dates.map(date => {
        const ex = exMap.get(`${pid}:${date}`)
        return {
          property_id: pid, date, price_override: adjusted,
          booking_status: ex?.booking_status ?? 'open',
          deposit: ex?.deposit ?? null,
          extra_person_fee: ex?.extra_person_fee ?? null,
          extra_large_bed: ex?.extra_large_bed ?? null,
          extra_small_bed: ex?.extra_small_bed ?? null,
          notes: ex?.notes ?? null,
        }
      }))
      const res = await fetch('/api/booking/pricing', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ settings }),
      })
      if (!res.ok) { const d = await res.json(); setApplyMsg(d.error ?? t('pricing.applyFailed')) }
      else { setApplyMsg(t('pricing.applyDone', { price: adjusted.toLocaleString(), props: targets.length, days: dates.length })); fetchData() }
    } catch (e) {
      setApplyMsg(String(e))
    } finally { setApplySaving(false) }
  }

  // 手動立即執行市場跟隨（只跑當前用戶，不用等排程）
  const [marketRunning, setMarketRunning] = useState(false)
  const [marketRunMsg, setMarketRunMsg] = useState<string | null>(null)
  async function runMarketNow() {
    setMarketRunning(true); setMarketRunMsg(null)
    try {
      const res = await fetch('/api/booking/pricing/market-run', { method: 'POST' })
      const d = await res.json()
      if (!res.ok) setMarketRunMsg(d.error ?? t('pricing.marketRunFailed'))
      else { setMarketRunMsg(t('pricing.marketRunDone', { snapshots: d.snapshots, applied: d.applied, apiCalls: d.apiCalls })); fetchData() }
    } catch (e) {
      setMarketRunMsg(String(e))
    } finally { setMarketRunning(false) }
  }

  async function runCompare(force = false) {
    if (!cmpLocation.trim()) { setCmpErr(t('pricing.enterLocation')); return }
    const key = `${cmpLocation.trim()}|${cmpCheckIn}|${cmpCheckOut}`
    if (!force) {
      const cached = cmpCache.current.get(key)
      if (cached) {
        setCmpItems(cached.items); setCmpStats(cached.stats)
        setCmpErr(null); setCmpQueried(true); setCmpFromCache(true)
        return
      }
    }
    setCmpLoading(true); setCmpErr(null); setCmpFromCache(false)
    try {
      const res = await fetch('/api/booking/pricing/compare', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ location: cmpLocation.trim(), check_in: cmpCheckIn, check_out: cmpCheckOut, force }),
      })
      const d = await res.json()
      if (!res.ok) { setCmpErr(d.error ?? t('pricing.queryFailed')); setCmpItems([]); setCmpStats(null) }
      else {
        setCmpItems(d.items ?? []); setCmpStats(d.stats ?? null)
        setCmpFromCache(!!d.cached)
        cmpCache.current.set(key, { items: d.items ?? [], stats: d.stats ?? null })
      }
      setCmpQueried(true)
    } catch (e) {
      setCmpErr(String(e))
    } finally { setCmpLoading(false) }
  }

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
  const monthName = new Date(year, month, 1).toLocaleDateString(locale, { year: 'numeric', month: 'long' })
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
    if (dates.length === 0) { alert(t('pricing.noMatchingDates')); return }
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
    if (!confirm(t('pricing.deleteRuleConfirm'))) return
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
    { t: 'daily'    as const, label: t('pricing.tabs.daily') },
    { t: 'calendar' as const, label: t('pricing.tabs.calendar') },
    { t: 'rules'    as const, label: t('pricing.tabs.rules') },
    { t: 'compare'  as const, label: t('pricing.tabs.compare') },
  ]

  function ViewSwitcher() {
    return (
      <div className="flex rounded-lg border overflow-hidden text-xs font-medium shrink-0">
        {VIEW_TABS_CFG.map(({ t: tabId, label }) => (
          <button key={tabId} onClick={() => setTab(tabId)}
            className={`px-2.5 py-1.5 transition-colors whitespace-nowrap
              ${tab === tabId ? 'bg-indigo-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}>
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
                <option value="">{t('calendar.allProperties')}</option>
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
                <span className="text-xs text-indigo-600 font-semibold shrink-0">{t('pricing.cellsCount', { count: selectedCells.size })}</span>
              )}
              <button onClick={selectAllVisible}
                className="text-xs px-2.5 py-1 rounded-lg border hover:bg-gray-50 text-gray-600 whitespace-nowrap">
                {t('pricing.selectAll')}
              </button>
              {selectedCells.size > 0 && (
                <button onClick={clearSelection}
                  className="text-xs px-2.5 py-1 rounded-lg border hover:bg-gray-50 text-gray-600 whitespace-nowrap">
                  {t('pricing.clear')}
                </button>
              )}
              <button onClick={() => { setBatchProps(properties.map(p => p.id)); setShowBatch(true) }}
                className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg border border-indigo-300 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 whitespace-nowrap font-medium">
                <CalendarRange className="h-3.5 w-3.5" />
                {t('pricing.batchPricing')}
              </button>
            </div>
          </div>

          {/* Grid */}
          {loading ? (
            <div className="flex-1 flex items-center justify-center text-sm text-gray-400">{t('common.loading')}</div>
          ) : visibleProps.length === 0 ? (
            <div className="flex-1 flex items-center justify-center text-sm text-gray-400">{t('pricing.noRoomTypes')}</div>
          ) : (
            <div className="flex-1 overflow-auto">
              <table className="border-collapse" style={{ minWidth: 'max-content' }}>
                <thead className="sticky top-0 z-10">
                  <tr>
                    {/* Room column header */}
                    <th className="sticky left-0 z-20 bg-white border-b border-r px-2.5 py-2 text-left text-xs font-semibold text-gray-500 min-w-[80px]">
                      <span className="text-[10px] text-gray-400">{t('pricing.clickRowHint')}</span>
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
                            {t(`roomgrid.day.${dow}`)}
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
                          {p.dynamic_pricing_enabled && <span className="text-amber-500 text-[10px]">{t('pricing.dynamicTag')}</span>}
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
                                  {statusLabel(status)}
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
      ) : tab === 'rules' ? (
        /* ── Tab 2: 動態定價規則 ── */
        <div className="flex-1 overflow-y-auto p-4 md:p-5 space-y-6">
          <div className="flex justify-end"><ViewSwitcher /></div>
          {/* Dynamic pricing toggle per property */}
          <div>
            <h2 className="font-bold text-gray-900 mb-3">{t('pricing.dynamicToggle')}</h2>
            {loading ? (
              <div className="text-sm text-gray-400">{t('common.loading')}</div>
            ) : properties.length === 0 ? (
              <div className="text-sm text-gray-400">{t('pricing.noRoomTypes')}</div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {properties.map(p => (
                  <div key={p.id} className="bg-white rounded-xl border p-4 flex items-center justify-between">
                    <div>
                      <div className="font-semibold text-sm text-gray-900">{p.name}</div>
                      <div className="text-xs text-gray-400 mt-0.5">
                        {t('pricing.basePriceLabel')} NT$ {p.base_price ? Number(p.base_price).toLocaleString() : t('pricing.notSet')}
                      </div>
                      {p.dynamic_pricing_enabled && (
                        <div className="flex items-center gap-1 mt-1">
                          <Zap className="h-3 w-3 text-amber-500" />
                          <span className="text-[10px] text-amber-600 font-semibold">{t('pricing.dynamicOn')}</span>
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
            <div className="flex items-center justify-between mb-3 gap-2 flex-wrap">
              <div>
                <h2 className="font-bold text-gray-900">{t('nav.pricing')}</h2>
                <p className="text-xs text-gray-400 mt-0.5">{t('pricing.rulesNote')}</p>
              </div>
              <div className="flex items-center gap-2">
                {rules.some(r => r.rule_type === 'market') && (
                  <button onClick={runMarketNow} disabled={marketRunning}
                    title={t('pricing.marketRunTitle')}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold border text-indigo-600 border-indigo-300 hover:bg-indigo-50 disabled:opacity-50">
                    📈 {marketRunning ? t('pricing.running') : t('pricing.runMarketNow')}
                  </button>
                )}
                <button
                  onClick={() => setRuleModal({ enabled: true, adjustment_type: 'percent', adjustment_value: 0, priority: 0, conditions: {} })}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold bg-indigo-600 text-white hover:bg-indigo-700 transition-colors">
                  <Plus className="h-3.5 w-3.5" />
                  {t('pricing.addRule')}
                </button>
              </div>
            </div>
            {marketRunMsg && (
              <div className="mb-3 text-xs bg-indigo-50 border border-indigo-200 rounded-lg px-3 py-2 text-indigo-700">{marketRunMsg}</div>
            )}
            {loading ? (
              <div className="text-sm text-gray-400">{t('common.loading')}</div>
            ) : rules.length === 0 ? (
              <div className="bg-white rounded-xl border py-12 text-center text-sm text-gray-400">
                {t('pricing.noRules')}
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
                    const cfg = ruleCfg(rule.rule_type)
                    return (
                      <div key={rule.id} className="bg-white rounded-xl border p-3.5">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="font-semibold text-sm text-gray-900 truncate">{rule.name}</div>
                            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-1">
                              <span className="text-xs text-gray-500">{cfg?.icon} {cfg?.label}</span>
                              <span className={`text-xs font-semibold ${rule.adjustment_value >= 0 ? 'text-rose-600' : 'text-emerald-600'}`}>{adj}</span>
                              <span className="text-[10px] text-gray-400">{prop ? prop.name : t('pricing.allRoomTypes')}</span>
                              <span className="text-[10px] text-gray-400">{t('pricing.priorityShort', { n: rule.priority })}</span>
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
                        <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">{t('pricing.col.ruleName')}</th>
                        <th className="px-3 py-3 text-center text-xs font-semibold text-gray-500">{t('pricing.col.type')}</th>
                        <th className="px-3 py-3 text-center text-xs font-semibold text-gray-500">{t('pricing.col.adjust')}</th>
                        <th className="px-3 py-3 text-center text-xs font-semibold text-gray-500">{t('pricing.col.applyRoom')}</th>
                        <th className="px-3 py-3 text-center text-xs font-semibold text-gray-500">{t('pricing.col.status')}</th>
                        <th className="px-3 py-3 text-center text-xs font-semibold text-gray-500">{t('pricing.col.actions')}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {[...rules].sort((a, b) => b.priority - a.priority).map(rule => {
                        const prop = properties.find(p => p.id === rule.property_id)
                        const adj = rule.adjustment_type === 'percent'
                          ? `${rule.adjustment_value > 0 ? '+' : ''}${rule.adjustment_value}%`
                          : `${rule.adjustment_value > 0 ? '+' : ''}NT$ ${Math.abs(Number(rule.adjustment_value)).toLocaleString()}`
                        const cfg = ruleCfg(rule.rule_type)
                        return (
                          <tr key={rule.id} className="hover:bg-gray-50">
                            <td className="px-4 py-3">
                              <div className="font-medium text-gray-900">{rule.name}</div>
                              <div className="text-[10px] text-gray-400 mt-0.5">{t('pricing.priorityShort', { n: rule.priority })}</div>
                            </td>
                            <td className="px-3 py-3 text-center text-sm">{cfg?.icon} {cfg?.label}</td>
                            <td className="px-3 py-3 text-center">
                              <span className={rule.adjustment_value >= 0 ? 'text-rose-600 font-semibold' : 'text-emerald-600 font-semibold'}>{adj}</span>
                            </td>
                            <td className="px-3 py-3 text-center text-gray-600 text-xs">{prop ? prop.name : t('pricing.allRoomTypes')}</td>
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
      ) : (
        /* ── Tab 3: 周邊比價（SerpApi Google Hotels）── */
        <div className="flex-1 overflow-y-auto p-4 md:p-5 space-y-5">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <h2 className="font-bold text-gray-900">{t('pricing.tabs.compare')}</h2>
              <p className="text-xs text-gray-400 mt-0.5">{t('pricing.compareSubtitle')}</p>
            </div>
            <ViewSwitcher />
          </div>

          {/* 查詢條件 */}
          <div className="bg-white rounded-xl border p-4 space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              <div className="sm:col-span-2 space-y-1">
                <label className="text-xs font-medium text-gray-600">{t('pricing.locationKeyword')}</label>
                <input value={cmpLocation} onChange={e => setCmpLocation(e.target.value)}
                  placeholder={t('pricing.locationPlaceholder')}
                  className="w-full text-sm border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-300" />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-gray-600">{t('pricing.checkInDate')}</label>
                <input type="date" value={cmpCheckIn} onChange={e => setCmpCheckIn(e.target.value)}
                  className="w-full text-sm border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-300" />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-gray-600">{t('pricing.checkOutDate')}</label>
                <input type="date" value={cmpCheckOut} onChange={e => setCmpCheckOut(e.target.value)}
                  className="w-full text-sm border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-300" />
              </div>
            </div>
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <p className="text-[11px] text-gray-400">{t('pricing.quotaNote')}</p>
              <div className="flex gap-2">
                {cmpQueried && (
                  <button onClick={() => runCompare(true)} disabled={cmpLoading}
                    className="px-3 py-2 rounded-lg text-sm font-medium border text-gray-600 hover:bg-gray-50 disabled:opacity-50">
                    {t('pricing.forceRequery')}
                  </button>
                )}
                <button onClick={() => runCompare()} disabled={cmpLoading}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50">
                  {cmpLoading ? t('pricing.querying') : t('pricing.queryNearby')}
                </button>
              </div>
            </div>
            {cmpErr && <div className="text-xs text-red-500">{cmpErr}</div>}
          </div>

          {/* 關注競品 */}
          <div className="bg-white rounded-xl border p-4 space-y-3">
            <div>
              <h3 className="text-sm font-semibold text-gray-800">{t('pricing.watchlist')}</h3>
              <p className="text-[11px] text-gray-400 mt-0.5">{t('pricing.watchlistHint')}</p>
            </div>
            <div className="flex gap-2">
              <input value={watchInput} onChange={e => setWatchInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') addWatch() }}
                placeholder={t('pricing.watchPlaceholder')}
                className="flex-1 text-sm border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-300" />
              <button onClick={addWatch}
                className="px-3 py-2 rounded-lg text-sm font-medium bg-gray-800 text-white hover:bg-gray-900">{t('bookings.add')}</button>
            </div>
            {watchlist.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {watchlist.map(name => (
                  <span key={name} className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-indigo-50 text-indigo-700 text-xs">
                    {name}
                    <button onClick={() => removeWatch(name)} className="text-indigo-400 hover:text-red-500 font-bold leading-none">×</button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {cmpFromCache && (
            <div className="text-[11px] text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
              {t('pricing.cacheNote')}
            </div>
          )}

          {/* 統計卡 */}
          {cmpStats && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label: t('pricing.statMin'), v: cmpStats.min },
                { label: t('pricing.statMedian'), v: cmpStats.median },
                { label: t('pricing.statAvg'), v: cmpStats.avg },
                { label: t('pricing.statMax'), v: cmpStats.max },
              ].map(s => (
                <div key={s.label} className="bg-white rounded-xl border p-3 text-center">
                  <div className="text-[11px] text-gray-400">{s.label}</div>
                  <div className="text-lg font-bold text-gray-900 tabular-nums">NT$ {s.v.toLocaleString()}</div>
                </div>
              ))}
            </div>
          )}

          {/* 你的定價對比 */}
          {cmpStats && properties.some(p => p.base_price != null) && (
            <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4 space-y-2">
              <div className="text-sm font-semibold text-indigo-800">{t('pricing.yourVsMedian', { median: cmpStats.median.toLocaleString() })}</div>
              <div className="space-y-1.5">
                {properties.filter(p => p.base_price != null).map(p => {
                  const base = Number(p.base_price)
                  const diff = base - cmpStats.median
                  const pct = cmpStats.median ? Math.round((diff / cmpStats.median) * 100) : 0
                  return (
                    <div key={p.id} className="flex items-center justify-between text-xs">
                      <span className="text-gray-700">{p.name}</span>
                      <span className="tabular-nums text-gray-700">
                        NT$ {base.toLocaleString()}
                        <span className={`ml-2 font-semibold ${diff > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                          {diff > 0 ? t('pricing.higher') : t('pricing.lower')} {Math.abs(pct)}%
                        </span>
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* 套用到動態定價（方案A：手動基準套用）*/}
          {cmpStats && (
            <div className="bg-white rounded-xl border p-4 space-y-3">
              <div>
                <h3 className="text-sm font-semibold text-gray-800">{t('pricing.applyToDynamic')}</h3>
                <p className="text-[11px] text-gray-400 mt-0.5">{t('pricing.applyToDynamicHint')}</p>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <div className="space-y-1">
                  <label className="text-[11px] text-gray-500">{t('pricing.basis')}</label>
                  <select value={applyBasis} onChange={e => setApplyBasis(e.target.value as 'median' | 'min' | 'avg')}
                    className="w-full text-sm border rounded-lg px-2 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-white">
                    <option value="median">{t('pricing.statMedian')} {cmpStats.median.toLocaleString()}</option>
                    <option value="min">{t('pricing.statMin')} {cmpStats.min.toLocaleString()}</option>
                    <option value="avg">{t('pricing.statAvg')} {cmpStats.avg.toLocaleString()}</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] text-gray-500">{t('pricing.adjustPct')}</label>
                  <input type="number" value={applyOffset} onChange={e => setApplyOffset(e.target.value)}
                    placeholder="-5"
                    className="w-full text-sm border rounded-lg px-2 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-300" />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] text-gray-500">{t('pricing.from')}</label>
                  <input type="date" value={applyFrom} onChange={e => setApplyFrom(e.target.value)}
                    className="w-full text-sm border rounded-lg px-2 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-300" />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] text-gray-500">{t('pricing.to')}</label>
                  <input type="date" value={applyTo} onChange={e => setApplyTo(e.target.value)}
                    className="w-full text-sm border rounded-lg px-2 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-300" />
                </div>
              </div>
              <div className="flex items-center gap-1 flex-wrap">
                <span className="text-[11px] text-gray-500 mr-1">{t('pricing.weekday')}</span>
                {DOW.map((d, i) => (
                  <button key={i} onClick={() => setApplyDow(prev => prev.includes(i) ? prev.filter(x => x !== i) : [...prev, i])}
                    className={`w-7 h-7 rounded-lg text-xs font-medium border transition-colors ${applyDow.includes(i) ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-gray-500 border-gray-200'}`}>
                    {d}
                  </button>
                ))}
              </div>
              {properties.length > 1 && (
                <div className="flex flex-wrap gap-1.5 items-center">
                  <span className="text-[11px] text-gray-500 mr-1">{t('pricing.roomType')}</span>
                  {properties.map(p => (
                    <button key={p.id} onClick={() => setApplyProps(prev => prev.includes(p.id) ? prev.filter(x => x !== p.id) : [...prev, p.id])}
                      className={`px-2 py-1 rounded-lg text-xs font-medium border transition-colors ${applyProps.includes(p.id) ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-gray-600 border-gray-200'}`}>
                      {p.name}
                    </button>
                  ))}
                  <span className="text-[11px] text-gray-400">{t('pricing.noneEqualsAll')}</span>
                </div>
              )}
              <div className="flex items-center justify-between gap-2 flex-wrap border-t pt-3">
                <div className="text-xs text-gray-600">
                  {t('pricing.applyPriceLabel')}<span className="font-bold text-indigo-600 text-base">NT$ {previewApplyPrice()?.toLocaleString() ?? '—'}</span>
                  <span className="text-gray-400 ml-1">（{applyBasis === 'median' ? t('pricing.statMedian') : applyBasis === 'min' ? t('pricing.statMin') : t('pricing.statAvg')} {(parseFloat(applyOffset) || 0) >= 0 ? '+' : ''}{applyOffset || 0}%）</span>
                </div>
                <button onClick={applyToPricing} disabled={applySaving}
                  className="px-4 py-2 rounded-lg text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50">
                  {applySaving ? t('pricing.applying') : t('pricing.applyToDaily')}
                </button>
              </div>
              {applyMsg && <div className="text-xs text-emerald-600">{applyMsg}</div>}
            </div>
          )}

          {/* 周邊清單 */}
          {cmpItems.length > 0 ? (
            <div className="bg-white rounded-xl border overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500">{t('pricing.colName')}</th>
                    <th className="px-3 py-2.5 text-center text-xs font-semibold text-gray-500">{t('pricing.col.type')}</th>
                    <th className="px-3 py-2.5 text-right text-xs font-semibold text-gray-500">{t('pricing.perNight')}</th>
                    <th className="px-3 py-2.5 text-center text-xs font-semibold text-gray-500">{t('pricing.colRating')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {[...cmpItems]
                    .sort((a, b) => (isWatched(b.name) ? 1 : 0) - (isWatched(a.name) ? 1 : 0))
                    .map((it, i) => {
                      const watched = isWatched(it.name)
                      return (
                        <tr key={i} className={watched ? 'bg-amber-50' : 'hover:bg-gray-50'}>
                          <td className="px-4 py-2.5 text-gray-900">{watched && <span className="mr-1">⭐</span>}{it.name}</td>
                          <td className="px-3 py-2.5 text-center text-xs text-gray-500">{it.type ?? '—'}</td>
                          <td className="px-3 py-2.5 text-right tabular-nums font-semibold text-gray-900">{it.price != null ? `NT$ ${it.price.toLocaleString()}` : '—'}</td>
                          <td className="px-3 py-2.5 text-center text-xs text-gray-600">{it.rating != null ? `⭐ ${it.rating}${it.reviews != null ? `（${it.reviews}）` : ''}` : '—'}</td>
                        </tr>
                      )
                    })}
                </tbody>
              </table>
            </div>
          ) : cmpQueried && !cmpLoading && !cmpErr ? (
            <div className="bg-white rounded-xl border py-12 text-center text-sm text-gray-400">{t('pricing.noCompareData')}</div>
          ) : null}

          {/* 關注競品：周邊清單未涵蓋者 */}
          {cmpQueried && (() => {
            const missing = watchlist.filter(w => !cmpItems.some(it => nameMatches(it.name, w)))
            if (missing.length === 0) return null
            return (
              <div className="bg-white rounded-xl border p-4 space-y-2">
                <div className="text-sm font-semibold text-gray-800">{t('pricing.watchMissingTitle')}</div>
                <p className="text-[11px] text-gray-400">{t('pricing.watchMissingHint')}</p>
                <div className="space-y-1.5 pt-1">
                  {missing.map(name => {
                    const wp = watchPrices[name]
                    return (
                      <div key={name} className="flex items-center justify-between gap-2 text-xs">
                        <span className="text-gray-700">{name}</span>
                        <div className="flex items-center gap-2">
                          {wp === undefined ? (
                            <button onClick={() => queryWatch(name)} disabled={watchQuerying === name}
                              className="px-2 py-1 rounded-lg border text-gray-600 hover:bg-gray-50 disabled:opacity-50">
                              {watchQuerying === name ? t('pricing.querying') : t('pricing.preciseQuery')}
                            </button>
                          ) : wp === null ? (
                            <span className="text-gray-400">{t('pricing.notFound')}
                              <button onClick={() => queryWatch(name)} className="text-indigo-500 hover:underline ml-1">{t('pricing.retry')}</button>
                            </span>
                          ) : (
                            <span className="tabular-nums font-semibold text-gray-900">
                              {wp.price != null ? `NT$ ${wp.price.toLocaleString()}` : t('pricing.noQuote')}
                              {wp.rating != null && <span className="ml-2 text-gray-500 font-normal">⭐{wp.rating}</span>}
                            </span>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })()}
        </div>
      )}

      {/* Fixed action bar — appears when grid cells are selected */}
      {tab === 'calendar' && (selectedCells.size > 0 || showPriceInput) && typeof window !== 'undefined' && createPortal(
        <div className="fixed bottom-0 left-0 right-0 z-[9990] bg-white border-t shadow-2xl px-4 py-3">
          {showPriceInput ? (
            <div className="flex items-center gap-2 flex-wrap max-w-4xl mx-auto">
              <button onClick={() => { setShowPriceInput(false); setPendingPrice('') }}
                className="text-gray-400 hover:text-gray-600 font-bold text-xl leading-none shrink-0">×</button>
              <span className="text-sm font-medium text-gray-700 shrink-0">{t('pricing.overridePrice')} NT$</span>
              <input type="number" value={pendingPrice} onChange={e => setPendingPrice(e.target.value)}
                placeholder={t('pricing.blankClearOverride')} autoFocus
                className="flex-1 min-w-0 text-sm border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-sky-300" />
              <button onClick={async () => { await applyPrice(pendingPrice ? parseFloat(pendingPrice) : null); setShowPriceInput(false); setPendingPrice('') }}
                disabled={applyingSaving}
                className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50 whitespace-nowrap">
                {applyingSaving ? t('pricing.applying') : t('bookings.form.apply')}
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-3 flex-wrap max-w-4xl mx-auto">
              <button onClick={clearSelection}
                className="text-gray-400 hover:text-gray-600 font-bold text-xl leading-none shrink-0">×</button>
              <span className="text-sm font-semibold text-indigo-700 shrink-0">{t('pricing.selectedCount', { count: selectedCells.size })}</span>
              <div className="flex gap-2 flex-wrap ml-auto">
                {([
                  { status: 'open' as BookingStatus,      label: t('pricing.openBooking'), cls: 'bg-emerald-600 hover:bg-emerald-700' },
                  { status: 'admin_only' as BookingStatus, label: t('pricing.adminOnly'),   cls: 'bg-amber-500 hover:bg-amber-600' },
                  { status: 'closed' as BookingStatus,     label: t('pricing.notBookable'), cls: 'bg-red-600 hover:bg-red-700' },
                ] as const).map(({ status, label, cls }) => (
                  <button key={status} onClick={() => applyStatus(status)} disabled={applyingSaving}
                    className={`px-4 py-2 rounded-lg text-white text-sm font-semibold disabled:opacity-50 ${cls}`}>
                    {label}
                  </button>
                ))}
                <button onClick={() => setShowPriceInput(true)}
                  className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700">
                  {t('pricing.setPrice')}
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
                <h3 className="font-bold text-gray-900">{t('pricing.batchTitle')}</h3>
                <p className="text-xs text-gray-400 mt-0.5">{t('pricing.batchSubtitle')}</p>
              </div>
              <button onClick={() => { setShowBatch(false); setSelectedHolidays(new Set()) }} className="p-1.5 hover:bg-gray-100 rounded-lg">
                <X className="h-4 w-4 text-gray-500" />
              </button>
            </div>

            {/* Holiday presets */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <div className="text-xs font-semibold text-gray-700">{t('pricing.quickHolidays')}</div>
                {selectedHolidays.size > 0 && (
                  <span className="text-[11px] text-indigo-600 font-semibold">{t('pricing.holidaysSelected', { count: selectedHolidays.size })}</span>
                )}
                {holidaysLoading && (
                  <span className="text-[11px] text-gray-400 animate-pulse">{t('pricing.aiFetching')}</span>
                )}
              </div>
              <p className="text-[11px] text-gray-400">{t('pricing.multiSelectHint')}</p>
              {!holidaysLoading && holidays.length === 0 && (
                <div className="text-[11px] text-gray-400">{t('pricing.noHolidayData')}</div>
              )}
              {holidays.length > 0 && (
                <div className="space-y-2">
                  {/* 連續假期 */}
                  {holidays.filter(h => h.type === 'holiday').length > 0 && (
                    <div>
                      <div className="text-[10px] text-gray-400 mb-1">{t('pricing.consecutiveHolidays')}</div>
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
                      <div className="text-[10px] text-gray-400 mb-1">{t('pricing.schoolHolidays')}</div>
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
              <div className="text-xs font-semibold text-gray-700">{t('pricing.manualRange')}</div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] text-gray-500 mb-1 block">{t('pricing.startDate')}</label>
                  <input type="date" value={batchFrom} onChange={e => setBatchFrom(e.target.value)}
                    className="w-full text-sm border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-300" />
                </div>
                <div>
                  <label className="text-[11px] text-gray-500 mb-1 block">{t('pricing.endDate')}</label>
                  <input type="date" value={batchTo} onChange={e => setBatchTo(e.target.value)}
                    className="w-full text-sm border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-300" />
                </div>
              </div>
              {getAllSelectedDates().length > 0 && (
                <div className="text-[11px] text-gray-400">
                  {t('pricing.totalDays', { count: getAllSelectedDates().length })}
                </div>
              )}
            </div>

            {/* DOW filter */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="text-xs font-semibold text-gray-700">{t('pricing.applyWeekday')}</div>
                <div className="flex gap-2 text-xs text-indigo-600">
                  <button onClick={() => setBatchDow([0,1,2,3,4,5,6])} className="hover:underline">{t('pricing.dowAll')}</button>
                  <button onClick={() => setBatchDow([1,2,3,4,5])} className="hover:underline">{t('pricing.dowWeekday')}</button>
                  <button onClick={() => setBatchDow([0,6])} className="hover:underline">{t('pricing.dowWeekend')}</button>
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
                  <div className="text-xs font-semibold text-gray-700">{t('pricing.applyRoomType')}</div>
                  <button onClick={() => setBatchProps(p => p.length === properties.length ? [] : properties.map(x => x.id))}
                    className="text-xs text-indigo-600 hover:underline">
                    {batchProps.length === properties.length ? t('pricing.deselectAll') : t('pricing.selectAll')}
                  </button>
                </div>
                <div className="space-y-1.5">
                  {properties.map(p => (
                    <label key={p.id} className="flex items-center gap-2.5 cursor-pointer py-1">
                      <input type="checkbox" checked={batchProps.includes(p.id)}
                        onChange={e => setBatchProps(prev => e.target.checked ? [...prev, p.id] : prev.filter(id => id !== p.id))}
                        className="rounded border-gray-300 text-indigo-600" />
                      <span className="text-sm text-gray-700">{p.name}</span>
                      {p.base_price && <span className="text-xs text-gray-400">{t('pricing.basePriceLabel')} {Number(p.base_price).toLocaleString()}</span>}
                    </label>
                  ))}
                </div>
              </div>
            )}

            {/* Price */}
            <div className="space-y-2">
              <div className="text-xs font-semibold text-gray-700">{t('pricing.overrideRoomPrice')}</div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-500 shrink-0">NT$</span>
                <input type="number" min="0" value={batchPrice} onChange={e => setBatchPrice(e.target.value)}
                  placeholder={t('pricing.blankNoChange')}
                  className="flex-1 text-sm border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-300" />
                {batchPrice && (
                  <button onClick={() => setBatchPrice('')} className="text-gray-400 hover:text-gray-600 shrink-0">
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
              <p className="text-[11px] text-gray-400">{t('pricing.overrideNote')}</p>
            </div>

            {/* Status */}
            <div className="space-y-2">
              <div className="text-xs font-semibold text-gray-700">{t('pricing.bookingStatusOptional')}</div>
              <div className="flex gap-2 flex-wrap">
                {([
                  { v: '' as const,           label: t('pricing.noChange'),    cls: 'border-gray-200 text-gray-500 bg-white' },
                  { v: 'open' as const,        label: t('pricing.openBooking'), cls: 'border-emerald-300 text-emerald-700 bg-emerald-50' },
                  { v: 'admin_only' as const,  label: t('pricing.adminOnlyFull'), cls: 'border-amber-300 text-amber-700 bg-amber-50' },
                  { v: 'closed' as const,      label: t('pricing.notBookableFull'), cls: 'border-red-300 text-red-700 bg-red-50' },
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
                className="flex-1 py-2.5 rounded-xl text-sm border text-gray-600 hover:bg-gray-50">{t('bookings.form.cancel')}</button>
              <button
                onClick={applyBatch}
                disabled={getAllSelectedDates().length === 0 || (!batchPrice && !batchStatus) || batchSaving}
                className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50">
                {batchSaving ? t('pricing.applying') : t('pricing.applyDays', { count: getAllSelectedDates().length })}
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
              <h3 className="font-bold text-gray-900">{ruleModal.id ? t('pricing.editRule') : t('pricing.addRuleTitle')}</h3>
              <button onClick={() => setRuleModal(null)} className="p-1.5 hover:bg-gray-100 rounded-lg">
                <X className="h-4 w-4 text-gray-500" />
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1">{t('pricing.ruleNameLabel')}</label>
                <input value={ruleModal.name ?? ''} onChange={e => setRuleModal(p => ({ ...p, name: e.target.value }))}
                  placeholder={t('pricing.ruleNamePlaceholder')}
                  className="w-full text-sm border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-sky-300" />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-gray-600 block mb-1">{t('pricing.ruleTypeLabel')}</label>
                  <select value={ruleModal.rule_type ?? ''} onChange={e => setRuleModal(p => ({ ...p, rule_type: e.target.value as RuleType }))}
                    className="w-full text-sm border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-sky-300">
                    <option value="">{t('pricing.selectType')}</option>
                    {(Object.keys(RULE_TYPE_ICON) as RuleType[]).map(k => <option key={k} value={k}>{RULE_TYPE_ICON[k]} {t(`pricing.ruleTypes.${k}`)}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600 block mb-1">{t('pricing.col.applyRoom')}</label>
                  <select value={ruleModal.property_id ?? ''} onChange={e => setRuleModal(p => ({ ...p, property_id: e.target.value || null }))}
                    className="w-full text-sm border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-sky-300">
                    <option value="">{t('pricing.allRoomTypes')}</option>
                    {properties.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-gray-600 block mb-1">{t('pricing.adjustType')}</label>
                  <select value={ruleModal.adjustment_type ?? 'percent'} onChange={e => setRuleModal(p => ({ ...p, adjustment_type: e.target.value as AdjType }))}
                    className="w-full text-sm border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-sky-300">
                    <option value="percent">{t('pricing.adjustPercent')}</option>
                    <option value="fixed">{t('pricing.adjustFixed')}</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600 block mb-1">{t('pricing.adjustValue')}</label>
                  <input type="number" value={ruleModal.adjustment_value ?? 0}
                    onChange={e => setRuleModal(p => ({ ...p, adjustment_value: parseFloat(e.target.value) || 0 }))}
                    className="w-full text-sm border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-sky-300" />
                </div>
              </div>
              {ruleModal.rule_type === 'seasonal' && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-medium text-gray-600 block mb-1">{t('pricing.startMmdd')}</label>
                    <input value={(ruleModal.conditions as Record<string, string>)?.start_mmdd ?? ''}
                      onChange={e => setRuleModal(p => ({ ...p, conditions: { ...p?.conditions, start_mmdd: e.target.value } }))}
                      placeholder="07-01" className="w-full text-sm border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-sky-300" />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-600 block mb-1">{t('pricing.endMmdd')}</label>
                    <input value={(ruleModal.conditions as Record<string, string>)?.end_mmdd ?? ''}
                      onChange={e => setRuleModal(p => ({ ...p, conditions: { ...p?.conditions, end_mmdd: e.target.value } }))}
                      placeholder="08-31" className="w-full text-sm border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-sky-300" />
                  </div>
                </div>
              )}
              {ruleModal.rule_type === 'holiday' && (
                <div>
                  <label className="text-xs font-medium text-gray-600 block mb-1">{t('pricing.specifyDates')}</label>
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
                  <label className="text-xs font-medium text-gray-600 block mb-1">{t('pricing.occupancyThreshold')}</label>
                  <input type="number" step="0.05" min="0" max="1"
                    value={(ruleModal.conditions as Record<string, number>)?.threshold ?? 0.8}
                    onChange={e => setRuleModal(p => ({ ...p, conditions: { ...p?.conditions, threshold: parseFloat(e.target.value) } }))}
                    className="w-full text-sm border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-sky-300" />
                </div>
              )}
              {ruleModal.rule_type === 'advance_booking' && (
                <div>
                  <label className="text-xs font-medium text-gray-600 block mb-1">
                    {t('pricing.advanceLabel')}
                  </label>
                  <p className="text-[11px] text-gray-400 mb-1.5">
                    {t('pricing.advanceHint')}
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
                    {t('pricing.earlyBirdLabel')}
                  </label>
                  <p className="text-[11px] text-gray-400 mb-1.5">
                    {t('pricing.earlyBirdHint')}
                  </p>
                  <input type="number" min="1"
                    value={(ruleModal.conditions as Record<string, number>)?.days_before ?? 90}
                    onChange={e => setRuleModal(p => ({ ...p, conditions: { ...p?.conditions, days_before: parseInt(e.target.value) } }))}
                    className="w-full text-sm border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-sky-300" />
                </div>
              )}
              {ruleModal.rule_type === 'market' && (
                <div className="space-y-2">
                  <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-2.5 text-[11px] text-indigo-700 leading-relaxed">
                    {t('pricing.marketRuleHint')}
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-600 block mb-1">{t('pricing.basis')}</label>
                    <select value={(ruleModal.conditions as Record<string, string>)?.basis ?? 'median'}
                      onChange={e => setRuleModal(p => ({ ...p, conditions: { ...p?.conditions, basis: e.target.value } }))}
                      className="w-full text-sm border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-sky-300 bg-white">
                      <option value="median">{t('pricing.nearbyMedian')}</option>
                      <option value="min">{t('pricing.nearbyMin')}</option>
                      <option value="avg">{t('pricing.nearbyAvg')}</option>
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-xs font-medium text-gray-600 block mb-1">{t('pricing.priceFloor')}</label>
                      <input type="number"
                        value={(ruleModal.conditions as Record<string, number | null>)?.floor ?? ''}
                        onChange={e => setRuleModal(p => ({ ...p, conditions: { ...p?.conditions, floor: e.target.value === '' ? null : parseInt(e.target.value) } }))}
                        placeholder={t('pricing.notBelow')}
                        className="w-full text-sm border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-sky-300" />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-gray-600 block mb-1">{t('pricing.priceCeil')}</label>
                      <input type="number"
                        value={(ruleModal.conditions as Record<string, number | null>)?.ceil ?? ''}
                        onChange={e => setRuleModal(p => ({ ...p, conditions: { ...p?.conditions, ceil: e.target.value === '' ? null : parseInt(e.target.value) } }))}
                        placeholder={t('pricing.notAbove')}
                        className="w-full text-sm border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-sky-300" />
                    </div>
                  </div>
                </div>
              )}
              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1">{t('pricing.priorityLabel')}</label>
                <input type="number" value={ruleModal.priority ?? 0}
                  onChange={e => setRuleModal(p => ({ ...p, priority: parseInt(e.target.value) || 0 }))}
                  className="w-full text-sm border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-sky-300" />
              </div>
            </div>
            <div className="flex gap-2 pt-1">
              <button onClick={() => setRuleModal(null)} className="flex-1 py-2.5 rounded-xl text-sm border text-gray-600 hover:bg-gray-50">{t('bookings.form.cancel')}</button>
              <button onClick={saveRule} disabled={!ruleModal.name || !ruleModal.rule_type || ruleSaving}
                className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50">
                {ruleSaving ? t('bookings.form.saving') : t('pricing.saveRule')}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}
