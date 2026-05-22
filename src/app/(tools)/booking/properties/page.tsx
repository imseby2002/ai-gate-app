'use client'
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Plus, Edit2, Trash2, BedDouble, X, ImagePlus, Loader2 } from 'lucide-react'

interface Property {
  id: string; name: string; description: string
  room_count: number; max_guests: number; base_price: number | null
  currency: string; status: string; name_aliases: string[]
  amenities: string[]; images: string[]
}

const EMPTY_FORM = {
  name: '', description: '', room_count: 1, max_guests: 2,
  base_price: '', currency: 'TWD', name_aliases: [] as string[],
  amenities: [] as string[], images: [] as string[],
}

const AMENITY_GROUPS = [
  { group: '景觀', items: ['海景', '山景', '河景', '市景', '無邊際泳池', '私人泳池'] },
  { group: '戶外空間', items: ['露台', '陽台', '私人花園', '庭院', 'BBQ 區'] },
  { group: '床型', items: ['雙人床', '加大雙人床', '兩張單人床', '上下鋪', '沙發床'] },
  { group: '房間設施', items: ['冷氣', '電視', '第四台/串流', '冰箱', '保險箱', '書桌', '沙發'] },
  { group: '衛浴', items: ['獨立衛浴', '浴缸', '淋浴間', '吹風機', '盥洗用品', '免治馬桶'] },
  { group: '公共設施', items: ['WiFi', '停車位', '廚房', '公共廚房', '洗衣機', '烘衣機'] },
  { group: '餐飲服務', items: ['早餐', '下午茶', '迷你吧', '咖啡/茶'] },
  { group: '其他服務', items: ['24H 入住', '行李寄存', '機場接送', '腳踏車租借'] },
]

type ModalTab = '基本資料' | '設施' | '照片'

export default function PropertiesPage() {
  const [properties, setProperties] = useState<Property[]>([])
  const [loading, setLoading]   = useState(true)
  const [editing, setEditing]   = useState<Property | null>(null)
  const [adding, setAdding]     = useState(false)
  const [form, setForm]         = useState(EMPTY_FORM)
  const [aliasInput, setAliasInput] = useState('')
  const [saving, setSaving]     = useState(false)
  const [modalTab, setModalTab] = useState<ModalTab>('基本資料')
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

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
      amenities: p.amenities ?? [],
      images: p.images ?? [],
    })
    setAliasInput('')
    setModalTab('基本資料')
  }

  function openAdd() {
    setAdding(true)
    setForm(EMPTY_FORM)
    setAliasInput('')
    setModalTab('基本資料')
  }

  function addAlias() {
    const v = aliasInput.trim()
    if (!v || form.name_aliases.includes(v)) return
    setForm(f => ({ ...f, name_aliases: [...f.name_aliases, v] }))
    setAliasInput('')
  }

  function removeAlias(a: string) {
    setForm(f => ({ ...f, name_aliases: f.name_aliases.filter(x => x !== a) }))
  }

  function toggleAmenity(item: string) {
    setForm(f => ({
      ...f,
      amenities: f.amenities.includes(item)
        ? f.amenities.filter(a => a !== item)
        : [...f.amenities, item],
    }))
  }

  async function uploadPhoto(file: File) {
    setUploading(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await fetch('/api/booking/photos', { method: 'POST', body: fd })
      const d = await res.json()
      if (d.url) setForm(f => ({ ...f, images: [...f.images, d.url] }))
    } finally { setUploading(false) }
  }

  async function removePhoto(url: string) {
    setForm(f => ({ ...f, images: f.images.filter(u => u !== url) }))
    await fetch('/api/booking/photos', {
      method: 'DELETE', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url }),
    })
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
  const TABS: ModalTab[] = ['基本資料', '設施', '照片']

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
              {(p.images ?? []).length > 0 ? (
                <img src={p.images[0]} alt={p.name}
                  className="w-16 h-16 rounded-xl object-cover shrink-0" />
              ) : (
                <div className="w-16 h-16 rounded-xl bg-indigo-50 flex items-center justify-center shrink-0">
                  <BedDouble className="h-6 w-6 text-indigo-400" />
                </div>
              )}
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
                {(p.amenities ?? []).length > 0 && (
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    {p.amenities.slice(0, 6).map(a => (
                      <span key={a} className="text-[10px] px-1.5 py-0.5 bg-gray-50 text-gray-600 border rounded-full">{a}</span>
                    ))}
                    {p.amenities.length > 6 && (
                      <span className="text-[10px] px-1.5 py-0.5 bg-gray-50 text-gray-400 border rounded-full">+{p.amenities.length - 6}</span>
                    )}
                  </div>
                )}
                {(p.name_aliases ?? []).length > 0 && (
                  <div className="mt-1 flex flex-wrap gap-1">
                    {p.name_aliases.map(a => (
                      <span key={a} className="text-[10px] px-1.5 py-0.5 bg-sky-50 text-sky-700 border border-sky-200 rounded-full">{a}</span>
                    ))}
                  </div>
                )}
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
          <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-xl w-full sm:max-w-2xl max-h-[92dvh] flex flex-col">

            {/* Modal header */}
            <div className="px-5 pt-5 pb-0 shrink-0">
              <h3 className="font-bold text-gray-900 mb-3">{editing ? '編輯房型' : '新增房型'}</h3>
              {/* Tabs */}
              <div className="flex border-b gap-1">
                {TABS.map(t => (
                  <button key={t} onClick={() => setModalTab(t)}
                    className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors -mb-px
                      ${modalTab === t ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
                    {t}
                  </button>
                ))}
              </div>
            </div>

            {/* Tab content */}
            <div className="overflow-y-auto flex-1 px-5 py-4 space-y-3">

              {/* ── 基本資料 ── */}
              {modalTab === '基本資料' && <>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-gray-600">房型名稱（中文內部名稱）<span className="text-red-500">*</span></label>
                  <input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                    placeholder="例：海景房、標準雙人房"
                    className="w-full text-sm border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-300" />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-gray-600">
                    平台別名
                    <span className="ml-1 font-normal text-gray-400">（各平台顯示的外語名稱，用於 Email 自動比對）</span>
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
              </>}

              {/* ── 設施 ── */}
              {modalTab === '設施' && (
                <div className="space-y-4">
                  <p className="text-xs text-gray-500">勾選此房型提供的設施</p>
                  {AMENITY_GROUPS.map(({ group, items }) => (
                    <div key={group}>
                      <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">{group}</div>
                      <div className="flex flex-wrap gap-2">
                        {items.map(item => {
                          const checked = form.amenities.includes(item)
                          return (
                            <button key={item} type="button" onClick={() => toggleAmenity(item)}
                              className={`text-xs px-3 py-1.5 rounded-full border transition-colors
                                ${checked
                                  ? 'bg-indigo-600 text-white border-indigo-600'
                                  : 'bg-white text-gray-600 border-gray-300 hover:border-indigo-400'}`}>
                              {item}
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* ── 照片 ── */}
              {modalTab === '照片' && (
                <div className="space-y-3">
                  <p className="text-xs text-gray-500">上傳此房型的照片，第一張為封面</p>
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                    {form.images.map((url, i) => (
                      <div key={url} className="relative aspect-square rounded-xl overflow-hidden border group">
                        <img src={url} alt={`photo-${i}`} className="w-full h-full object-cover" />
                        {i === 0 && (
                          <span className="absolute top-1 left-1 text-[10px] bg-indigo-600 text-white px-1.5 py-0.5 rounded-full">封面</span>
                        )}
                        <button onClick={() => removePhoto(url)}
                          className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/60 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    ))}
                    <button type="button" onClick={() => fileRef.current?.click()}
                      disabled={uploading}
                      className="aspect-square rounded-xl border-2 border-dashed border-gray-300 flex flex-col items-center justify-center gap-1 hover:border-indigo-400 transition-colors">
                      {uploading
                        ? <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
                        : <ImagePlus className="h-5 w-5 text-gray-400" />}
                      <span className="text-[10px] text-gray-400">{uploading ? '上傳中…' : '新增照片'}</span>
                    </button>
                  </div>
                  <input ref={fileRef} type="file" accept="image/*" className="hidden"
                    onChange={e => { const f = e.target.files?.[0]; if (f) uploadPhoto(f); e.target.value = '' }} />
                </div>
              )}
            </div>

            {/* Footer buttons */}
            <div className="shrink-0 flex gap-2 px-5 py-4 border-t">
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
