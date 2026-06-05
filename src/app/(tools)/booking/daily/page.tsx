'use client'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Plus, Trash2, RefreshCw, ChevronLeft, ChevronRight, Eye, EyeOff } from 'lucide-react'

interface DailyRecord {
  id: string
  date: string
  room_name: string
  room_password: string | null
  gate_password: string | null
  order_number: string | null
  guest_name: string | null
  source: 'traiwan' | 'manual' | 'booking'
  sort_order: number
}

type EditableField = 'room_name' | 'room_password' | 'gate_password' | 'order_number' | 'guest_name'

const COLS: { key: EditableField; label: string; width: string; sensitive?: boolean }[] = [
  { key: 'room_name',     label: '房號',     width: 'w-24' },
  { key: 'room_password', label: '房門密碼', width: 'w-32', sensitive: true },
  { key: 'gate_password', label: '大門密碼', width: 'w-32', sensitive: true },
  { key: 'order_number',  label: '訂單號碼', width: 'w-36' },
  { key: 'guest_name',    label: '旅客姓名', width: 'w-32' },
]

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
  onStartEdit: (id: string, field: EditableField, val: string | null) => void
  onCommitEdit: () => void
  onCancelEdit: () => void
  onEditValChange: (v: string) => void
}

function Cell({ row, col, editing, editVal, showPasswords, saving, inputRef, onStartEdit, onCommitEdit, onCancelEdit, onEditValChange }: CellProps) {
  const val = row[col.key]
  const isEditing = editing?.id === row.id && editing?.field === col.key
  const masked = col.sensitive && !showPasswords && val

  if (isEditing) {
    return (
      <input
        ref={inputRef}
        value={editVal}
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

  return (
    <div
      onClick={() => onStartEdit(row.id, col.key, val)}
      className={`min-h-[32px] px-2 py-1 rounded cursor-pointer text-sm transition-colors
        hover:bg-indigo-50 group flex items-center gap-1
        ${!val ? 'text-gray-300' : 'text-gray-800'}
        ${saving === row.id ? 'opacity-60' : ''}`}
    >
      {masked ? '••••••' : (val || '點擊填入')}
      {row.source === 'traiwan' && col.key === 'order_number' && val && (
        <span className="text-[10px] bg-green-100 text-green-600 px-1 rounded ml-1">自動</span>
      )}
      {row.source === 'booking' && col.key === 'order_number' && val && (
        <span className="text-[10px] bg-blue-100 text-blue-600 px-1 rounded ml-1">訂單</span>
      )}
    </div>
  )
}

export default function DailyPage() {
  const [date, setDate] = useState(todayTW)
  const [rows, setRows] = useState<DailyRecord[]>([])
  const [unmatched, setUnmatched] = useState<UnmatchedBooking[]>([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState<string | null>(null)
  const [showPasswords, setShowPasswords] = useState(false)
  const [editing, setEditing] = useState<{ id: string; field: EditableField } | null>(null)
  const [editVal, setEditVal] = useState('')
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

  useEffect(() => {
    if (editing) inputRef.current?.focus()
  }, [editing])

  async function startEdit(id: string, field: EditableField, val: string | null) {
    setEditing({ id, field })
    setEditVal(val ?? '')
  }

  async function commitEdit() {
    if (!editing) return
    const { id, field } = editing
    setEditing(null)
    const original = rows.find(r => r.id === id)
    if (!original || original[field] === (editVal || null)) return
    const newVal = editVal || null

    // 大門密碼全棟共用：編輯時自動同步到當日所有房間，免逐間重複輸入
    if (field === 'gate_password') {
      const targets = rows.filter(r => r.gate_password !== newVal)
      setRows(prev => prev.map(r => ({ ...r, gate_password: newVal })))
      setSaving(id)
      try {
        await Promise.all(targets.map(r =>
          fetch('/api/booking/daily', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: r.id, gate_password: newVal }),
          })
        ))
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

  async function addRow() {
    const res = await fetch('/api/booking/daily', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ date, room_name: `房間 ${rows.length + 1}`, source: 'manual', sort_order: rows.length }),
    })
    const [created] = await res.json()
    if (created) {
      setRows(prev => [...prev, created])
      setTimeout(() => startEdit(created.id, 'room_name', created.room_name), 50)
    }
  }

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
    <div className="p-4 sm:p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
        <div>
          <h1 className="text-lg font-semibold text-gray-900">每日入住記錄</h1>
          <p className="text-sm text-gray-500 mt-0.5">房號 · 密碼 · 旅客資訊</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setShowPasswords(v => !v)}
            className="flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg border hover:bg-gray-50 text-gray-600">
            {showPasswords ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            {showPasswords ? '隱藏密碼' : '顯示密碼'}
          </button>
          <button onClick={load} disabled={loading}
            className="flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg border hover:bg-gray-50 text-gray-600 disabled:opacity-50">
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            重新整理
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
            className="text-xs text-indigo-600 hover:underline ml-1">回今天</button>
        )}
        <span className="text-sm text-gray-500 ml-1">{fmtDate(date)}{isToday ? '（今天）' : ''}</span>
      </div>

      {/* Table */}
      <div className="border rounded-xl overflow-hidden bg-white shadow-sm">
        <div className="grid bg-gray-50 border-b text-xs font-semibold text-gray-500 uppercase tracking-wide"
          style={{ gridTemplateColumns: '1fr 1fr 1fr 1.5fr 1fr 2rem' }}>
          {COLS.map(c => (
            <div key={c.key} className="px-3 py-2.5">{c.label}</div>
          ))}
          <div />
        </div>

        {loading ? (
          <div className="py-12 text-center text-sm text-gray-400">載入中…</div>
        ) : rows.length === 0 ? (
          <div className="py-12 text-center">
            <p className="text-sm text-gray-400 mb-3">尚無資料，請手動新增房間</p>
          </div>
        ) : (
          rows.map((row, i) => (
            <div key={row.id}
              className={`grid items-center border-b last:border-0 hover:bg-gray-50/50 transition-colors
                ${i % 2 === 0 ? '' : 'bg-gray-50/30'}`}
              style={{ gridTemplateColumns: '1fr 1fr 1fr 1.5fr 1fr 2rem' }}>
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

      {/* Add row */}
      <button onClick={addRow}
        className="mt-3 flex items-center gap-2 text-sm text-indigo-600 hover:text-indigo-700 px-2 py-1.5 rounded-lg hover:bg-indigo-50 transition-colors">
        <Plus className="h-4 w-4" />
        新增房間
      </button>

      <p className="mt-4 text-xs text-gray-400">
        點擊任意格子即可編輯 · 大門密碼填一次會自動套用到當日所有房間 · 綠色「自動」= 已同步資料 · 藍色「訂單」= 訂房系統帶入 · 密碼預設隱藏
      </p>

      {/* 未分配訂單 */}
      {unmatched.length > 0 && (
        <div className="mt-6">
          <h2 className="text-sm font-semibold text-gray-600 mb-2">
            今日訂單（未對應房間，共 {unmatched.length} 筆）
          </h2>
          <div className="border rounded-xl overflow-hidden bg-white shadow-sm">
            <div className="grid bg-amber-50 border-b text-xs font-semibold text-amber-700 uppercase tracking-wide"
              style={{ gridTemplateColumns: '1fr 1fr' }}>
              <div className="px-3 py-2.5">旅客姓名</div>
              <div className="px-3 py-2.5">訂單號碼</div>
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
            ⚠ 這些訂單的房型尚未對應，請至「訂單」頁面手動指定房型後即可自動帶入
          </p>
        </div>
      )}
    </div>
  )
}
