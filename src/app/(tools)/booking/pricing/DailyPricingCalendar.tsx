'use client'
import { useState, useEffect, useCallback } from 'react'
import { ChevronLeft, ChevronRight, Save, Check } from 'lucide-react'

interface Property {
  id: string; name: string; base_price: number | null; currency: string
}
interface DayPricing {
  price: string; deposit: string; extra_person: string
  extra_large_bed: string; extra_small_bed: string; status: string
}
type LocalEdits = Record<string, DayPricing>

const EMPTY: DayPricing = {
  price: '', deposit: '', extra_person: '',
  extra_large_bed: '', extra_small_bed: '', status: 'open',
}

const DOW_LABELS = ['一','二','三','四','五','六','日']

function toDateStr(y: number, m: number, d: number) {
  return `${y}-${String(m + 1).padStart(2,'0')}-${String(d).padStart(2,'0')}`
}
function getDaysInMonth(y: number, m: number) {
  return new Date(y, m + 1, 0).getDate()
}
function getDowIdx(dateStr: string) {
  const dow = new Date(dateStr + 'T00:00:00').getDay()
  return dow === 0 ? 6 : dow - 1  // Mon=0 ... Sun=6
}

type TabType = 'daily' | 'calendar' | 'rules' | 'compare'
const VIEW_TABS: { t: TabType; label: string }[] = [
  { t: 'daily',    label: '每日定價' },
  { t: 'calendar', label: '格狀視圖' },
  { t: 'rules',    label: '定價規則' },
  { t: 'compare',  label: '周邊比價' },
]

interface Props {
  year: number; month: number
  onPrev: () => void; onNext: () => void
  properties: Property[]
  tab: TabType
  onTabChange: (t: TabType) => void
}

export default function DailyPricingCalendar({ year, month, onPrev, onNext, properties, tab, onTabChange }: Props) {
  const [propId, setPropId]       = useState(properties[0]?.id ?? '')
  const [edits, setEdits]         = useState<LocalEdits>({})
  const [orig, setOrig]           = useState<LocalEdits>({})
  const [loading, setLoading]     = useState(false)
  const [saving, setSaving]       = useState(false)
  const [savedOk, setSavedOk]     = useState(false)

  // Quick-fill template
  const [qPrice, setQPrice]           = useState('')
  const [qDeposit, setQDeposit]       = useState('')
  const [qExtraPerson, setQExtraPerson] = useState('')
  const [qLargeBed, setQLargeBed]     = useState('')
  const [qSmallBed, setQSmallBed]     = useState('')

  const daysInMonth = getDaysInMonth(year, month)
  const allDates: string[] = Array.from({ length: daysInMonth }, (_, i) => toDateStr(year, month, i + 1))
  const selectedProp = properties.find(p => p.id === propId)

  const load = useCallback(async () => {
    if (!propId) return
    setLoading(true)
    const from = allDates[0]
    const to   = allDates[allDates.length - 1]
    const res = await fetch(`/api/booking/pricing?from=${from}&to=${to}&property_id=${propId}`)
    const data = await res.json()

    const map: LocalEdits = {}
    for (const d of allDates) map[d] = { ...EMPTY }
    for (const s of data.settings ?? []) {
      if (map[s.date]) {
        map[s.date] = {
          price:           s.price_override  != null ? String(s.price_override)  : '',
          deposit:         s.deposit         != null ? String(s.deposit)         : '',
          extra_person:    s.extra_person_fee != null ? String(s.extra_person_fee) : '',
          extra_large_bed: s.extra_large_bed != null ? String(s.extra_large_bed) : '',
          extra_small_bed: s.extra_small_bed != null ? String(s.extra_small_bed) : '',
          status:          s.booking_status ?? 'open',
        }
      }
    }
    setEdits(map)
    setOrig(JSON.parse(JSON.stringify(map)))
    setSavedOk(false)
    setLoading(false)
  }, [propId, year, month])

  useEffect(() => { load() }, [load])

  function set(date: string, field: keyof DayPricing, val: string) {
    setEdits(prev => ({ ...prev, [date]: { ...(prev[date] ?? EMPTY), [field]: val } }))
    setSavedOk(false)
  }

  function applyQuickFill() {
    setEdits(prev => {
      const next = { ...prev }
      for (const d of allDates) {
        next[d] = {
          ...(next[d] ?? EMPTY),
          ...(qPrice       ? { price: qPrice }                     : {}),
          ...(qDeposit     ? { deposit: qDeposit }                 : {}),
          ...(qExtraPerson ? { extra_person: qExtraPerson }        : {}),
          ...(qLargeBed    ? { extra_large_bed: qLargeBed }        : {}),
          ...(qSmallBed    ? { extra_small_bed: qSmallBed }        : {}),
        }
      }
      return next
    })
    setSavedOk(false)
  }

  const hasPending = JSON.stringify(edits) !== JSON.stringify(orig)

  async function save() {
    if (!propId) return
    setSaving(true)
    try {
      const settings = allDates.map(date => {
        const e = edits[date] ?? EMPTY
        return {
          property_id: propId, date,
          price_override:   e.price           !== '' ? parseFloat(e.price)           : null,
          deposit:          e.deposit         !== '' ? parseFloat(e.deposit)         : null,
          extra_person_fee: e.extra_person    !== '' ? parseFloat(e.extra_person)    : null,
          extra_large_bed:  e.extra_large_bed !== '' ? parseFloat(e.extra_large_bed) : null,
          extra_small_bed:  e.extra_small_bed !== '' ? parseFloat(e.extra_small_bed) : null,
          booking_status: e.status,
        }
      })
      await fetch('/api/booking/pricing', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ settings }),
      })
      setOrig(JSON.parse(JSON.stringify(edits)))
      setSavedOk(true)
    } finally { setSaving(false) }
  }

  // Calendar grid (Mon-first)
  const firstDowIdx = getDowIdx(allDates[0])
  const cells: (string | null)[] = [...Array(firstDowIdx).fill(null), ...allDates]
  while (cells.length % 7 !== 0) cells.push(null)
  const weeks: (string | null)[][] = []
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7))

  const today = new Date().toISOString().slice(0, 10)
  const monthName = new Date(year, month, 1).toLocaleDateString('zh-TW', { year: 'numeric', month: 'long' })

  const FIELDS: { key: keyof DayPricing; label: string }[] = [
    { key: 'price',           label: '房價' },
    { key: 'deposit',         label: '訂金' },
    { key: 'extra_person',    label: '加人價' },
    { key: 'extra_large_bed', label: '加大床' },
    { key: 'extra_small_bed', label: '加小床' },
  ]

  return (
    <div className="flex flex-col flex-1 overflow-hidden">

      {/* Top bar */}
      <div className="bg-white border-b shrink-0 space-y-2 px-4 py-2.5">

        {/* Row 1: selectors + month nav + save */}
        <div className="flex items-center gap-3 flex-wrap">
          {properties.length > 1 && (
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-gray-500 shrink-0">房型：</span>
              <select value={propId} onChange={e => { setPropId(e.target.value); setSavedOk(false) }}
                className="text-sm border rounded-lg px-2.5 py-1.5 bg-white focus:outline-none">
                {properties.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
          )}
          <div className="flex items-center gap-1">
            <button onClick={onPrev} className="p-1.5 rounded hover:bg-gray-100"><ChevronLeft className="h-4 w-4" /></button>
            <span className="text-sm font-bold min-w-[88px] text-center">{monthName}</span>
            <button onClick={onNext} className="p-1.5 rounded hover:bg-gray-100"><ChevronRight className="h-4 w-4" /></button>
          </div>
          <span className="text-xs text-gray-400 hidden sm:block">（粉紅底為週五～日；國定假日請於「定價規則」另設）</span>
          <div className="ml-auto flex items-center gap-2">
            {/* View switcher */}
            <div className="flex rounded-lg border overflow-hidden text-xs font-medium shrink-0">
              {VIEW_TABS.map(({ t, label }) => (
                <button key={t} onClick={() => onTabChange(t)}
                  className={`px-2.5 py-1.5 transition-colors whitespace-nowrap
                    ${tab === t ? 'bg-indigo-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}>
                  {label}
                </button>
              ))}
            </div>
            {savedOk && !hasPending && (
              <span className="flex items-center gap-1 text-xs text-emerald-600 font-medium">
                <Check className="h-3.5 w-3.5" /> 已儲存
              </span>
            )}
            <button onClick={save} disabled={!hasPending || saving}
              className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-sky-500 text-white text-sm font-semibold hover:bg-sky-600 disabled:opacity-40 transition-colors">
              <Save className="h-3.5 w-3.5" /> {saving ? '儲存中…' : '儲存'}
            </button>
          </div>
        </div>

        {/* Row 2: Quick-fill template + currency display */}
        <div className="flex items-center gap-2 flex-wrap bg-sky-50 rounded-lg px-3 py-2">
          <span className="text-xs font-semibold text-sky-700 shrink-0">快速填入</span>
          {[
            { label: '房價',   val: qPrice,       set: setQPrice },
            { label: '訂金',   val: qDeposit,     set: setQDeposit },
            { label: '加人價', val: qExtraPerson,  set: setQExtraPerson },
            { label: '加大床', val: qLargeBed,    set: setQLargeBed },
            { label: '加小床', val: qSmallBed,    set: setQSmallBed },
          ].map(({ label, val, set: setFn }) => (
            <div key={label} className="flex items-center gap-1">
              <span className="text-[11px] text-sky-600 shrink-0">{label}</span>
              <input type="number" value={val} onChange={e => setFn(e.target.value)}
                placeholder="—"
                className="w-20 text-xs border border-sky-200 rounded px-1.5 py-1 focus:outline-none focus:ring-1 focus:ring-sky-400 bg-white" />
            </div>
          ))}
          <button onClick={applyQuickFill}
            className="px-3 py-1.5 rounded-lg bg-sky-500 text-white text-xs font-semibold hover:bg-sky-600 transition-colors">
            套用全月
          </button>
          <span className="ml-auto text-xs text-gray-400 shrink-0">
            使用貨幣：{selectedProp?.currency ?? 'TWD'} 新台幣
          </span>
        </div>
      </div>

      {/* Calendar */}
      <div className="flex-1 overflow-auto">
        {loading ? (
          <div className="flex items-center justify-center h-32 text-gray-400 text-sm">載入中…</div>
        ) : properties.length === 0 ? (
          <div className="flex items-center justify-center h-32 text-gray-400 text-sm">尚無房型</div>
        ) : (
          <table className="border-collapse" style={{ minWidth: 900, width: '100%' }}>
            <thead>
              <tr className="bg-sky-500 text-white text-xs sticky top-0 z-10">
                <th className="border border-sky-400 px-2 py-2 w-12 text-center font-medium">單位: 新台幣</th>
                {DOW_LABELS.map((d, i) => (
                  <th key={d} className={`border border-sky-400 px-1 py-2 text-center font-medium
                    ${i >= 4 ? 'bg-red-400' : ''}`}
                    style={{ minWidth: 130 }}>
                    週{d}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {weeks.map((week, wi) => (
                <tr key={wi}>
                  <td className="border border-gray-200 bg-white text-center text-xs text-gray-500 font-semibold align-middle w-12">
                    第{wi + 1}週
                  </td>
                  {week.map((date, di) => {
                    if (!date) {
                      return <td key={di} className={`border border-gray-200 ${di >= 4 ? 'bg-pink-50' : 'bg-white'}`} />
                    }
                    const e = edits[date] ?? EMPTY
                    const isToday  = date === today
                    const isWkend  = di >= 4
                    const isClosed = e.status === 'closed'
                    const bgCls    = isClosed ? 'bg-red-100' : isWkend ? 'bg-pink-50' : 'bg-white'
                    const day      = parseInt(date.slice(8))

                    return (
                      <td key={date} className={`border border-gray-200 ${bgCls} align-top p-1.5`}>
                        {/* Day number */}
                        <div className={`text-xs font-bold mb-1 flex items-center gap-1
                          ${isToday ? 'text-sky-600' : isWkend ? 'text-red-500' : 'text-gray-700'}`}>
                          {day}
                          {isClosed && <span className="text-[10px] text-red-500 font-medium">（關閉）</span>}
                        </div>

                        {/* Price fields */}
                        {FIELDS.map(({ key, label }) => (
                          <div key={key} className="flex items-center gap-1 mb-0.5">
                            <span className="text-[10px] text-gray-400 w-11 shrink-0">{label}</span>
                            <input
                              type="number" min="0"
                              value={e[key] as string}
                              onChange={ev => set(date, key, ev.target.value)}
                              placeholder={key === 'price' && selectedProp?.base_price ? String(selectedProp.base_price) : ''}
                              className="flex-1 w-0 min-w-0 text-xs border rounded px-1 py-0.5 focus:outline-none focus:ring-1 focus:ring-sky-300
                                border-gray-200 bg-white hover:border-sky-300 transition-colors"
                            />
                          </div>
                        ))}

                        {/* Status */}
                        <div className="flex items-center gap-1 mt-1">
                          <span className="text-[10px] text-gray-400 w-11 shrink-0">狀態</span>
                          <select value={e.status}
                            onChange={ev => set(date, 'status', ev.target.value)}
                            className={`flex-1 w-0 min-w-0 text-[10px] border rounded px-0.5 py-0.5 focus:outline-none bg-white
                              ${e.status === 'closed' ? 'border-red-300 text-red-600' :
                                e.status === 'admin_only' ? 'border-amber-300 text-amber-600' :
                                'border-gray-200'}`}>
                            <option value="open">開放</option>
                            <option value="closed">關閉</option>
                            <option value="admin_only">後台</option>
                          </select>
                        </div>
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
