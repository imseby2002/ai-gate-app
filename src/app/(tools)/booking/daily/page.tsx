'use client'
import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { Trash2, RefreshCw, ChevronLeft, ChevronRight, Eye, EyeOff, Check, ExternalLink } from 'lucide-react'
import { InstallDailyButton } from './InstallDailyButton'

interface DailyRecord {
  id: string
  date: string
  room_name: string
  room_password: string | null
  gate_password: string | null
  order_number: string | null
  guest_name: string | null
  price_total: number | null
  deposit: number | null
  paid: boolean
  platform: string | null
  booking_id: string | null
  source: 'traiwan' | 'manual' | 'booking'
  sort_order: number
}

// 平台縮寫（顯示在訂單號碼後）
const PLATFORM_LABEL: Record<string, string> = {
  booking_com: 'Booking',
  agoda:       'Agoda',
  trip_com:    'Trip',
  asiayo:      'AsiaYo',
  airbnb:      'Airbnb',
  expedia:     'Expedia',
  hotels_com:  'Hotels',
  ctrip:       'Ctrip',
  klook:       'Klook',
  kkday:       'KKday',
  easytravel:  'EzTravel',
  traveloka:   'Traveloka',
  mafengwo:    'Mafengwo',
}
function platformLabel(p: string | null): string | null {
  if (!p || p === 'other') return null
  return PLATFORM_LABEL[p] ?? p
}

type ColKind = 'text' | 'num' | 'balance' | 'paid'
type EditableField = 'room_name' | 'room_password' | 'order_number' | 'guest_name' | 'price_total' | 'deposit'

// 大門密碼為全棟共用，獨立到表格上方輸入，不佔表格欄位（資料仍寫入每筆 record 供 AI 抓取）
const COLS: { key: string; labelKey: string; kind: ColKind; sensitive?: boolean }[] = [
  { key: 'room_name',     labelKey: 'daily.cols.room_name',     kind: 'text' },
  { key: 'room_password', labelKey: 'daily.cols.room_password', kind: 'text', sensitive: true },
  { key: 'order_number',  labelKey: 'daily.cols.order_number',  kind: 'text' },
  { key: 'guest_name',    labelKey: 'daily.cols.guest_name',    kind: 'text' },
  { key: 'price_total',   labelKey: 'daily.cols.price_total',   kind: 'num' },
  { key: 'deposit',       labelKey: 'daily.cols.deposit',       kind: 'num' },
  { key: 'balance',       labelKey: 'daily.cols.balance',       kind: 'balance' },
  { key: 'paid',          labelKey: 'daily.cols.paid',          kind: 'paid' },
]

const GRID_COLS = 'minmax(70px,1fr) minmax(88px,1fr) minmax(150px,1.7fr) minmax(80px,1fr) minmax(78px,0.9fr) minmax(70px,0.9fr) minmax(70px,0.9fr) minmax(52px,0.6fr) 2rem'

const COL: Record<string, typeof COLS[number]> = Object.fromEntries(COLS.map(c => [c.key, c]))

const NUMERIC = new Set<EditableField>(['price_total', 'deposit'])

function toNum(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

function fmtMoney(v: number | null): string {
  return v == null ? '' : v.toLocaleString()
}

function todayTW() {
  return new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Taipei' })
}

function fmtDate(iso: string) {
  const [y, m, d] = iso.split('-')
  return `${y}/${m}/${d}`
}

function addDays(iso: string, n: number) {
  const d = new Date(iso)
  d.setDate(d.getDate() + n)
  return d.toLocaleDateString('sv-SE')
}

interface UnmatchedBooking {
  guest_name: string
  order_number: string
}

interface CellProps {
  row: DailyRecord
  col: typeof COLS[0]
  editing: { id: string; field: EditableField } | null
  editVal: string
  showPasswords: boolean
  saving: string | null
  inputRef: React.RefObject<HTMLInputElement | null>
  onStartEdit: (id: string, field: EditableField, val: string | number | null) => void
  onCommitEdit: () => void
  onCancelEdit: () => void
  onEditValChange: (v: string) => void
  onTogglePaid: (row: DailyRecord) => void
  editingPlatform: string | null
  onStartEditPlatform: (id: string) => void
  onCommitPlatform: (id: string, val: string) => void
  onCancelEditPlatform: () => void
  onContinueStay: (id: string) => void
}

function Cell({ row, col, editing, editVal, showPasswords, saving, inputRef, onStartEdit, onCommitEdit, onCancelEdit, onEditValChange, onTogglePaid, editingPlatform, onStartEditPlatform, onCommitPlatform, onCancelEditPlatform, onContinueStay }: CellProps) {
  const t = useTranslations('Booking')

  // 尾款 = 訂房價格 - 訂金（即時計算，不可編輯）
  if (col.kind === 'balance') {
    const price = toNum(row.price_total)
    const dep = toNum(row.deposit)
    const balance = price == null ? null : price - (dep ?? 0)
    return (
      <div className="min-h-[32px] px-2 py-1 text-sm flex items-center text-gray-700 font-medium">
        {balance == null ? <span className="text-gray-300">—</span> : fmtMoney(balance)}
      </div>
    )
  }

  // 是否已付款（點擊切換）
  if (col.kind === 'paid') {
    return (
      <div className="min-h-[32px] px-2 py-1 flex items-center">
        <button
          onClick={() => onTogglePaid(row)}
          className={`h-5 w-5 rounded border flex items-center justify-center transition-colors
            ${row.paid ? 'bg-green-500 border-green-500 text-white' : 'bg-white border-gray-300 hover:border-green-400'}`}>
          {row.paid && <Check className="h-3.5 w-3.5" />}
        </button>
      </div>
    )
  }

  const field = col.key as EditableField
  const raw = row[col.key as keyof DailyRecord]
  const isEditing = editing?.id === row.id && editing?.field === field
  const masked = col.sensitive && !showPasswords && raw

  if (isEditing) {
    return (
      <input
        ref={inputRef}
        value={editVal}
        inputMode={col.kind === 'num' ? 'numeric' : 'text'}
        onChange={e => onEditValChange(e.target.value)}
        onBlur={onCommitEdit}
        onKeyDown={e => {
          if (e.key === 'Enter') onCommitEdit()
          if (e.key === 'Escape') onCancelEdit()
        }}
        className="w-full px-2 py-1 text-sm border border-indigo-400 rounded focus:outline-none focus:ring-2 focus:ring-indigo-300"
      />
    )
  }

  const display = col.kind === 'num' ? fmtMoney(toNum(raw)) : (raw as string | null)

  const isEditingPlatform = col.key === 'order_number' && editingPlatform === row.id

  return (
    <div
      onClick={() => onStartEdit(row.id, field, raw as string | number | null)}
      className={`min-h-[32px] px-2 py-1 rounded cursor-pointer text-sm transition-colors
        hover:bg-indigo-50 group flex items-center gap-1 overflow-hidden
        ${!display ? 'text-gray-300' : 'text-gray-800'}
        ${saving === row.id ? 'opacity-60' : ''}`}
    >
      <span className="min-w-0 truncate">{masked ? '••••••' : (display || t('daily.clickToFill'))}</span>
      {(col.key === 'guest_name' || col.key === 'order_number') && !raw && (
        <button
          type="button"
          onClick={e => { e.stopPropagation(); onContinueStay(row.id) }}
          title={t('daily.continueStayHint')}
          className="text-[10px] bg-indigo-50 text-indigo-600 px-1.5 py-0.5 rounded ml-1 shrink-0 hover:bg-indigo-100">
          {t('daily.continueStay')}
        </button>
      )}
      {col.key === 'order_number' && raw && (
        isEditingPlatform ? (
          <select
            autoFocus
            value={row.platform ?? ''}
            onClick={e => e.stopPropagation()}
            onChange={e => onCommitPlatform(row.id, e.target.value)}
            onBlur={onCancelEditPlatform}
            className="text-[10px] border border-indigo-300 rounded px-0.5 py-0 ml-1 shrink-0 max-w-[68px] focus:outline-none"
          >
            <option value="">{t('daily.platformNone')}</option>
            {Object.entries(PLATFORM_LABEL).map(([k, label]) => (
              <option key={k} value={k}>{label}</option>
            ))}
          </select>
        ) : (
          <button
            type="button"
            onClick={e => { e.stopPropagation(); onStartEditPlatform(row.id) }}
            title={t('daily.editPlatform')}
            className="shrink-0">
            {platformLabel(row.platform) ? (
              <span className="text-[10px] bg-blue-100 text-blue-600 px-1 rounded ml-1 hover:bg-blue-200">{platformLabel(row.platform)}</span>
            ) : row.source === 'traiwan' ? (
              <span className="text-[10px] bg-green-100 text-green-600 px-1 rounded ml-1 hover:bg-green-200">{t('daily.autoTag')}</span>
            ) : (
              <span className="text-[10px] bg-gray-100 text-gray-400 px-1 rounded ml-1 hover:bg-gray-200">{t('daily.setPlatform')}</span>
            )}
          </button>
        )
      )}
      {col.key === 'order_number' && (
        <Link
          href={row.booking_id
            ? `/booking/bookings/${row.booking_id}`
            : `/booking/bookings?room_name=${encodeURIComponent(row.room_name)}&date=${row.date}${row.guest_name ? `&guest_name=${encodeURIComponent(row.guest_name)}` : ''}`}
          onClick={e => e.stopPropagation()}
          title={row.booking_id ? t('daily.openOrder') : t('daily.createOrder')}
          className="ml-1 text-gray-400 hover:text-indigo-600 shrink-0">
          <ExternalLink className="h-3.5 w-3.5" />
        </Link>
      )}
    </div>
  )
}

export default function DailyPage() {
  const t = useTranslations('Booking')
  const [date, setDate] = useState(todayTW)
  const [rows, setRows] = useState<DailyRecord[]>([])
  const [unmatched, setUnmatched] = useState<UnmatchedBooking[]>([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState<string | null>(null)
  const [showPasswords, setShowPasswords] = useState(false)
  const [editing, setEditing] = useState<{ id: string; field: EditableField } | null>(null)
  const [editVal, setEditVal] = useState('')
  const [editingPlatform, setEditingPlatform] = useState<string | null>(null)
  const [gatePw, setGatePw] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/booking/daily?date=${date}`)
      const data = await res.json()
      if (data.rooms) {
        setRows(Array.isArray(data.rooms) ? data.rooms : [])
        setUnmatched(Array.isArray(data.unmatched) ? data.unmatched : [])
      } else {
        setRows(Array.isArray(data) ? data : [])
        setUnmatched([])
      }
    } finally {
      setLoading(false)
    }
  }, [date])

  useEffect(() => { load() }, [load])

  // 大門密碼全棟共用，同步顯示於獨立輸入框（取任一房間的值）
  useEffect(() => { setGatePw(rows[0]?.gate_password ?? '') }, [rows])

  useEffect(() => {
    if (editing) inputRef.current?.focus()
  }, [editing])

  // 大門密碼：套用到當日所有房間 + 之後所有日期（資料仍寫入每筆 record 供 AI 抓取）
  async function commitGate() {
    const newVal = gatePw.trim() || null
    if ((rows[0]?.gate_password ?? null) === newVal) return
    setRows(prev => prev.map(r => ({ ...r, gate_password: newVal })))
    try {
      await fetch('/api/booking/daily', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ forward: true, from_date: date, field: 'gate_password', value: newVal }),
      })
    } catch { /* ignore */ }
  }

  function startEdit(id: string, field: EditableField, val: string | number | null) {
    setEditing({ id, field })
    setEditVal(val == null ? '' : String(val))
  }

  // 續住：帶入前一天同房間的訂單資料（單號/旅客/房價/訂金/已付款/平台），
  // 若前一天有連動訂單，該訂單的退房日也會延後一晚，涵蓋今天。
  async function continueStay(id: string) {
    setSaving(id)
    try {
      const res = await fetch('/api/booking/daily', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, action: 'continue' }),
      })
      const d = await res.json()
      if (res.ok && d) setRows(prev => prev.map(r => r.id === id ? { ...r, ...d } : r))
      else if (d?.error) alert(d.error)
    } finally {
      setSaving(null)
    }
  }

  async function commitEdit() {
    if (!editing) return
    const { id, field } = editing
    setEditing(null)
    const original = rows.find(r => r.id === id)
    if (!original) return

    // 輸入「續住」直接觸發帶入前一天資料，不當成一般文字存進去
    // （旅客、單號欄位都可能是使用者習慣輸入的地方，兩個欄位都要接住）
    if ((field === 'guest_name' || field === 'order_number') && (editVal.trim() === '續住' || editVal.trim() === '续住')) {
      continueStay(id)
      return
    }

    const isNum = NUMERIC.has(field)
    const newVal: string | number | null = isNum
      ? toNum(editVal)
      : (editVal || null)

    if (original[field] === newVal) return

    // 房門密碼：每房獨立，套用到「該房間」當天 + 之後所有日期
    if (field === 'room_password') {
      setRows(prev => prev.map(r => r.id === id ? { ...r, room_password: newVal as string | null } : r))
      setSaving(id)
      try {
        await fetch('/api/booking/daily', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ forward: true, from_date: date, field: 'room_password', value: newVal, room_name: original.room_name }),
        })
      } finally {
        setSaving(null)
      }
      return
    }

    const update = { [field]: newVal }
    setRows(prev => prev.map(r => r.id === id ? { ...r, ...update } : r))
    setSaving(id)
    try {
      await fetch('/api/booking/daily', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, ...update }),
      })
    } finally {
      setSaving(null)
    }
  }

  async function commitPlatform(id: string, val: string) {
    setEditingPlatform(null)
    const newVal = val || null
    const original = rows.find(r => r.id === id)
    if (!original || original.platform === newVal) return
    setRows(prev => prev.map(r => r.id === id ? { ...r, platform: newVal } : r))
    setSaving(id)
    try {
      await fetch('/api/booking/daily', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, platform: newVal }),
      })
    } finally {
      setSaving(null)
    }
  }

  async function togglePaid(row: DailyRecord) {
    const newVal = !row.paid
    setRows(prev => prev.map(r => r.id === row.id ? { ...r, paid: newVal } : r))
    setSaving(row.id)
    try {
      await fetch('/api/booking/daily', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: row.id, paid: newVal }),
      })
    } finally {
      setSaving(null)
    }
  }

  const renderCell = (row: DailyRecord, key: string) => (
    <Cell row={row} col={COL[key]} editing={editing} editVal={editVal}
      showPasswords={showPasswords} saving={saving} inputRef={inputRef}
      onStartEdit={startEdit} onCommitEdit={commitEdit}
      onCancelEdit={() => setEditing(null)} onEditValChange={setEditVal} onTogglePaid={togglePaid}
      editingPlatform={editingPlatform} onStartEditPlatform={setEditingPlatform}
      onCommitPlatform={commitPlatform} onCancelEditPlatform={() => setEditingPlatform(null)}
      onContinueStay={continueStay} />
  )

  async function deleteRow(id: string) {
    setRows(prev => prev.filter(r => r.id !== id))
    await fetch('/api/booking/daily', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    })
  }

  const isToday = date === todayTW()

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
        <div>
          <h1 className="text-lg font-semibold text-gray-900">{t('daily.title')}</h1>
          <p className="text-sm text-gray-500 mt-0.5">{t('daily.subtitle')}</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <InstallDailyButton label={t('daily.install')} iosHint={t('daily.installHint')} />
          <button
            onClick={() => setShowPasswords(v => !v)}
            className="flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg border hover:bg-gray-50 text-gray-600">
            {showPasswords ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            {showPasswords ? t('daily.hidePw') : t('daily.showPw')}
          </button>
          <button onClick={load} disabled={loading}
            className="flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg border hover:bg-gray-50 text-gray-600 disabled:opacity-50">
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            {t('daily.refresh')}
          </button>
        </div>
      </div>

      {/* Date nav */}
      <div className="flex items-center gap-2 mb-4">
        <button onClick={() => setDate(d => addDays(d, -1))}
          className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500">
          <ChevronLeft className="h-4 w-4" />
        </button>
        <input
          type="date"
          value={date}
          onChange={e => setDate(e.target.value)}
          className="text-sm font-medium border rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-300"
        />
        <button onClick={() => setDate(d => addDays(d, 1))}
          className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500">
          <ChevronRight className="h-4 w-4" />
        </button>
        {!isToday && (
          <button onClick={() => setDate(todayTW())}
            className="text-xs text-indigo-600 hover:underline ml-1">{t('daily.backToToday')}</button>
        )}
        <span className="text-sm text-gray-500 ml-1">{fmtDate(date)}{isToday ? t('daily.todayParen') : ''}</span>
      </div>

      {/* 大門密碼（全棟共用，獨立於表格） */}
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        <label className="text-sm font-medium text-gray-600 shrink-0">{t('daily.cols.gate_password')}</label>
        <input
          type={showPasswords ? 'text' : 'password'}
          value={gatePw}
          onChange={e => setGatePw(e.target.value)}
          onBlur={commitGate}
          onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
          placeholder={t('daily.clickToFill')}
          className="text-sm border rounded-lg px-3 py-1.5 w-44 focus:outline-none focus:ring-2 focus:ring-indigo-300"
        />
        <span className="text-xs text-gray-400">{t('daily.gateShared')}</span>
      </div>

      {/* Mobile cards */}
      <div className="sm:hidden space-y-3">
        {loading ? (
          <div className="py-12 text-center text-sm text-gray-400">{t('common.loading')}</div>
        ) : rows.length === 0 ? (
          <div className="py-12 text-center text-sm text-gray-400">{t('daily.empty')}</div>
        ) : (
          rows.map(row => (
            <div key={row.id}
              className={`rounded-2xl border bg-white shadow-sm overflow-hidden ${saving === row.id ? 'opacity-60' : ''}`}>
              {/* 標題：房號 */}
              <div className="flex items-center justify-between gap-2 px-4 py-2.5 bg-gray-50 border-b">
                <span className="font-semibold text-gray-900 text-[15px] min-w-0 truncate">{row.room_name}</span>
                <button onClick={() => deleteRow(row.id)}
                  className="p-1 text-gray-300 hover:text-red-400 rounded shrink-0">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>

              <div className="px-4 py-3 space-y-3">
                {/* 訂單 / 客人 */}
                <div className="space-y-2">
                  <div className="flex items-center gap-3">
                    <span className="w-14 shrink-0 text-xs text-gray-400">{t('daily.cols.order_number')}</span>
                    <div className="flex-1 min-w-0">{renderCell(row, 'order_number')}</div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="w-14 shrink-0 text-xs text-gray-400">{t('daily.cols.guest_name')}</span>
                    <div className="flex-1 min-w-0">{renderCell(row, 'guest_name')}</div>
                  </div>
                </div>

                {/* 費用 */}
                <div className="grid grid-cols-3 gap-2 pt-3 border-t">
                  <div>
                    <div className="text-[10px] text-gray-400 mb-0.5">{t('daily.cols.price_total')}</div>
                    {renderCell(row, 'price_total')}
                  </div>
                  <div>
                    <div className="text-[10px] text-gray-400 mb-0.5">{t('daily.cols.deposit')}</div>
                    {renderCell(row, 'deposit')}
                  </div>
                  <div>
                    <div className="text-[10px] text-gray-400 mb-0.5">{t('daily.cols.balance')}</div>
                    {renderCell(row, 'balance')}
                  </div>
                </div>

                {/* 已付款 + 房門密碼 */}
                <div className="flex items-center justify-between gap-3 pt-3 border-t">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-400">{t('daily.cols.paid')}</span>
                    {renderCell(row, 'paid')}
                  </div>
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-xs text-gray-400 shrink-0">{t('daily.cols.room_password')}</span>
                    <div className="min-w-[88px]">{renderCell(row, 'room_password')}</div>
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Table (desktop) */}
      <div className="hidden sm:block border rounded-xl overflow-x-auto bg-white shadow-sm">
        <div className="grid bg-gray-50 border-b text-xs font-semibold text-gray-500 uppercase tracking-wide"
          style={{ gridTemplateColumns: GRID_COLS }}>
          {COLS.map(c => (
            <div key={c.key} className="px-3 py-2.5 whitespace-nowrap">{t(c.labelKey)}</div>
          ))}
          <div />
        </div>

        {loading ? (
          <div className="py-12 text-center text-sm text-gray-400">{t('common.loading')}</div>
        ) : rows.length === 0 ? (
          <div className="py-12 text-center">
            <p className="text-sm text-gray-400 mb-3">{t('daily.empty')}</p>
          </div>
        ) : (
          rows.map((row, i) => (
            <div key={row.id}
              className={`grid items-center border-b last:border-0 hover:bg-gray-50/50 transition-colors
                ${i % 2 === 0 ? '' : 'bg-gray-50/30'}`}
              style={{ gridTemplateColumns: GRID_COLS }}>
              {COLS.map(col => (
                <div key={col.key} className="px-2 py-1">
                  <Cell
                    row={row}
                    col={col}
                    editing={editing}
                    editVal={editVal}
                    showPasswords={showPasswords}
                    saving={saving}
                    inputRef={inputRef}
                    onStartEdit={startEdit}
                    onCommitEdit={commitEdit}
                    onCancelEdit={() => setEditing(null)}
                    onEditValChange={setEditVal}
                    onTogglePaid={togglePaid}
                    editingPlatform={editingPlatform}
                    onStartEditPlatform={setEditingPlatform}
                    onCommitPlatform={commitPlatform}
                    onCancelEditPlatform={() => setEditingPlatform(null)}
                    onContinueStay={continueStay}
                  />
                </div>
              ))}
              <div className="flex justify-center pr-1">
                <button onClick={() => deleteRow(row.id)}
                  className="p-1 text-gray-300 hover:text-red-400 rounded transition-colors opacity-0 group-hover:opacity-100 hover:opacity-100">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      <p className="mt-4 text-xs text-gray-400">
        {t('daily.hint')}
      </p>

      {/* 未分配訂單 */}
      {unmatched.length > 0 && (
        <div className="mt-6">
          <h2 className="text-sm font-semibold text-gray-600 mb-2">
            {t('daily.unmatchedTitle', { count: unmatched.length })}
          </h2>
          <div className="border rounded-xl overflow-hidden bg-white shadow-sm">
            <div className="grid bg-amber-50 border-b text-xs font-semibold text-amber-700 uppercase tracking-wide"
              style={{ gridTemplateColumns: '1fr 1fr' }}>
              <div className="px-3 py-2.5">{t('daily.cols.guest_name')}</div>
              <div className="px-3 py-2.5">{t('daily.cols.order_number')}</div>
            </div>
            {unmatched.map((b, i) => (
              <div key={i} className="grid border-b last:border-0 text-sm"
                style={{ gridTemplateColumns: '1fr 1fr' }}>
                <div className="px-3 py-2.5 text-gray-800">{b.guest_name || '—'}</div>
                <div className="px-3 py-2.5 text-gray-500 font-mono text-xs">{b.order_number || '—'}</div>
              </div>
            ))}
          </div>
          <p className="mt-1.5 text-xs text-amber-600">
            {t('daily.unmatchedHint')}
          </p>
        </div>
      )}
    </div>
  )
}
