'use client'
import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { Plus, Edit2, Trash2, BedDouble, X } from 'lucide-react'

interface Property {
  id: string; name: string; description: string
  room_count: number; max_guests: number; base_price: number | null
  currency: string; status: string; name_aliases: string[]
}

const EMPTY_FORM = {
  name: '', description: '', room_count: 1, max_guests: 2,
  base_price: '', currency: 'TWD', name_aliases: [] as string[],
}

export default function PropertiesPage() {
  const [properties, setProperties] = useState<Property[]>([])
  const [loading, setLoading]   = useState(true)
  const [editing, setEditing]   = useState<Property | null>(null)
  const [adding, setAdding]     = useState(false)
  const [form, setForm]         = useState(EMPTY_FORM)
  const [aliasInput, setAliasInput] = useState('')
  const [saving, setSaving]     = useState(false)

  useEffect(() => {
    fetch('/api/booking/properties').then(r => r.json())
      .then(d => setProperties(d.properties ?? []))
      .finally(() => setLoading(false))
  }, [])

  function openEdit(p: Property) {
    setEditing(p)
    setForm({
      name: p.name, description: p.description ?? '',
      room_count: p.room_count, max_guests: p.max_guests,
      base_price: p.base_price?.toString() ?? '',
      currency: p.currency,
      name_aliases: p.name_aliases ?? [],
    })
    setAliasInput('')
  }

  function openAdd() { setAdding(true); setForm(EMPTY_FORM); setAliasInput('') }

  function addAlias() {
    const v = aliasInput.trim()
    if (!v || form.name_aliases.includes(v)) return
    setForm(f => ({ ...f, name_aliases: [...f.name_aliases, v] }))
    setAliasInput('')
  }

  function removeAlias(a: string) {
    setForm(f => ({ ...f, name_aliases: f.name_aliases.filter(x => x !== a) }))
  }

  async function save() {
    setSaving(true)
    try {
      const body = { ...form, base_price: form.base_price ? parseFloat(form.base_price) : null }
      if (editing) {
        const res = await fetch('/api/booking/properties', {
          method: 'PUT', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: editing.id, ...body }),
        })
        const d = await res.json()
        if (d.property) setProperties(prev => prev.map(p => p.id === editing.id ? d.property : p))
      } else {
        const res = await fetch('/api/booking/properties', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        })
        const d = await res.json()
        if (d.property) setProperties(prev => [...prev, d.property])
      }
      setEditing(null); setAdding(false); setForm(EMPTY_FORM)
    } finally { setSaving(false) }
  }

  async function del(id: string) {
    if (!confirm('確定刪除？')) return
    await fetch('/api/booking/properties', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) })
    setProperties(prev => prev.filter(p => p.id !== id))
  }

  const isOpen = adding || editing !== null

  return (
    <div className="p-4 md:p-6 pb-16 space-y-5 max-w-3xl">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-gray-900">房型管理</h1>
          <p className="text-sm text-gray-500 mt-0.5">設定各房間及平台別名，Email 同步時自動比對</p>
        </div>
        <button onClick={openAdd}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700">
          <Plus className="h-4 w-4" /> 新增房型
        </button>
      </div>

      {loading ? (
        <div className="text-center py-16 text-gray-400">載入中…</div>
      ) : properties.length === 0 ? (
        <div className="text-center py-16 text-gray-400 space-y-2">
          <BedDouble className="h-10 w-10 mx-auto opacity-30" />
          <p className="text-sm">尚未建立任何房型</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3">
          {properties.map(p => (
            <div key={p.id} className="bg-white border rounded-xl p-4 flex items-start gap-4">
              <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center shrink-0 mt-0.5">
                <BedDouble className="h-5 w-5 text-indigo-600" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-gray-900">{p.name}</span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${p.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                    {p.status === 'active' ? '上架' : '下架'}
                  </span>
                </div>
                <div className="text-xs text-gray-500 mt-0.5">
                  {p.room_count} 間 · 最多 {p.max_guests} 人
                  {p.base_price && ` · ${p.currency} ${Number(p.base_price).toLocaleString()}/晚`}
                </div>
                {(p.name_aliases ?? []).length > 0 && (
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    {p.name_aliases.map(a => (
                      <span key={a} className="text-[10px] px-1.5 py-0.5 bg-sky-50 text-sky-700 border border-sky-200 rounded-full">
                        {a}
                      </span>
                    ))}
                  </div>
                )}
                {p.description && <div className="text-xs text-gray-400 truncate mt-0.5">{p.description}</div>}
              </div>
              <div className="flex gap-1.5 shrink-0">
                <button onClick={() => openEdit(p)} className="p-2 rounded-lg hover:bg-indigo-50 text-indigo-600">
                  <Edit2 className="h-4 w-4" />
                </button>
                <button onClick={() => del(p.id)} className="p-2 rounded-lg hover:bg-red-50 text-red-500">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Form Modal */}
      {isOpen && createPortal(
        <div className="fixed inset-0 bg-black/40 z-[9999] flex items-end sm:items-center justify-center sm:p-4"
          onClick={e => { if (e.target === e.currentTarget) { setAdding(false); setEditing(null) } }}>
          <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-xl w-full sm:max-w-md max-h-[92dvh] overflow-y-auto p-5 space-y-3">
            <h3 className="font-bold text-gray-900">{editing ? '編輯房型' : '新增房型'}</h3>

            <div className="space-y-1">
              <label className="text-xs font-medium text-gray-600">房型名稱（中文內部名稱）<span className="text-red-500">*</span></label>
              <input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                placeholder="例：海景房、標準雙人房"
                className="w-full text-sm border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-300" />
            </div>

            {/* Platform aliases */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-gray-600">
                平台別名
                <span className="ml-1 font-normal text-gray-400">（各平台顯示的英文/外語名稱，用於 Email 自動比對）</span>
              </label>
              <div className="flex gap-2">
                <input value={aliasInput}
                  onChange={e => setAliasInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addAlias() } }}
                  placeholder="如：Sea View Double Room（按 Enter 新增）"
                  className="flex-1 text-sm border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-300" />
                <button onClick={addAlias} type="button"
                  className="px-3 py-2 rounded-lg bg-sky-600 text-white text-sm hover:bg-sky-700">
                  新增
                </button>
              </div>
              {form.name_aliases.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-1">
                  {form.name_aliases.map(a => (
                    <span key={a} className="flex items-center gap-1 text-xs px-2 py-0.5 bg-sky-50 text-sky-700 border border-sky-200 rounded-full">
                      {a}
                      <button onClick={() => removeAlias(a)} className="hover:text-red-500">
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
              <div className="text-[10px] text-gray-400">
                Agoda: Sea View Double Room · Booking.com: Sea View Room · Trip.com: 标准海景大床房
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-gray-600">描述</label>
              <textarea value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
                rows={2} className="w-full text-sm border rounded-lg px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-indigo-300" />
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-medium text-gray-600">間數</label>
                <input type="number" min={1} value={form.room_count}
                  onChange={e => setForm(p => ({ ...p, room_count: parseInt(e.target.value) }))}
                  className="w-full text-sm border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-300" />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-gray-600">最多人數</label>
                <input type="number" min={1} value={form.max_guests}
                  onChange={e => setForm(p => ({ ...p, max_guests: parseInt(e.target.value) }))}
                  className="w-full text-sm border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-300" />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-gray-600">底價/晚</label>
                <input type="number" value={form.base_price}
                  onChange={e => setForm(p => ({ ...p, base_price: e.target.value }))}
                  placeholder="2000"
                  className="w-full text-sm border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-300" />
              </div>
            </div>

            <div className="flex gap-2 pt-1">
              <button onClick={() => { setAdding(false); setEditing(null) }}
                className="flex-1 py-2 rounded-xl text-sm border text-gray-600 hover:bg-gray-50">取消</button>
              <button onClick={save} disabled={!form.name.trim() || saving}
                className="flex-1 py-2 rounded-xl text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50">
                {saving ? '儲存中…' : '儲存'}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}
