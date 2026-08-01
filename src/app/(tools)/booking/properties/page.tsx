'use client'
import { useEffect, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import { createPortal } from 'react-dom'
import { Plus, Edit2, Trash2, BedDouble, X, ImagePlus, Loader2, GripVertical } from 'lucide-react'

interface Property {
  id: string; name: string; description: string
  room_count: number; max_guests: number; base_price: number | null; extra_guest_fee: number | null
  currency: string; status: string; name_aliases: string[]
  amenities: string[]; images: string[]; sort_order: number
}

const EMPTY_FORM = {
  name: '', description: '', room_count: 1, max_guests: 2,
  base_price: '', extra_guest_fee: '', currency: 'TWD', name_aliases: [] as string[],
  amenities: [] as string[], images: [] as string[],
}

// 設施值以中文為標準儲存值（DB 內容），顯示時透過 t('amenities.<值>') 翻譯
const AMENITY_GROUPS = [
  { groupKey: 'view',    items: ['海景', '山景', '河景', '市景', '無邊際泳池', '私人泳池'] },
  { groupKey: 'outdoor', items: ['露台', '陽台', '私人花園', '庭院', 'BBQ 區'] },
  { groupKey: 'bed',     items: ['雙人床', '加大雙人床', '兩張單人床', '上下鋪', '沙發床'] },
  { groupKey: 'room',    items: ['冷氣', '電視', '第四台/串流', '冰箱', '保險箱', '書桌', '沙發'] },
  { groupKey: 'bath',    items: ['獨立衛浴', '浴缸', '淋浴間', '吹風機', '盥洗用品', '免治馬桶'] },
  { groupKey: 'public',  items: ['WiFi', '停車位', '廚房', '公共廚房', '洗衣機', '烘衣機'] },
  { groupKey: 'dining',  items: ['早餐', '下午茶', '迷你吧', '咖啡/茶'] },
  { groupKey: 'other',   items: ['24H 入住', '行李寄存', '機場接送', '腳踏車租借'] },
]

type ModalTab = 'basic' | 'amenities' | 'photos'

export default function PropertiesPage() {
  const t = useTranslations('Booking')
  // 設施顯示：有翻譯用翻譯，無則回退原始（中文）值，確保舊資料也能顯示
  const amenityLabel = (v: string) => t.has(`amenities.${v}`) ? t(`amenities.${v}`) : v
  const [properties, setProperties] = useState<Property[]>([])
  const [loading, setLoading]   = useState(true)
  const [editing, setEditing]   = useState<Property | null>(null)
  const [adding, setAdding]     = useState(false)
  const [form, setForm]         = useState(EMPTY_FORM)
  const [aliasInput, setAliasInput] = useState('')
  const [saving, setSaving]     = useState(false)
  const [saveError, setSaveError] = useState('')
  const [modalTab, setModalTab] = useState<ModalTab>('basic')
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const [dragId, setDragId] = useState<string | null>(null)

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
      extra_guest_fee: p.extra_guest_fee?.toString() ?? '',
      currency: p.currency,
      name_aliases: p.name_aliases ?? [],
      amenities: p.amenities ?? [],
      images: p.images ?? [],
    })
    setAliasInput('')
    setModalTab('basic')
    setSaveError('')
  }

  function openAdd() {
    setAdding(true)
    setForm(EMPTY_FORM)
    setAliasInput('')
    setModalTab('basic')
    setSaveError('')
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

  function setCover(url: string) {
    setForm(f => ({ ...f, images: [url, ...f.images.filter(u => u !== url)] }))
  }

  async function save() {
    setSaving(true); setSaveError('')
    try {
      const body = {
        ...form,
        base_price: form.base_price ? parseFloat(form.base_price) : null,
        extra_guest_fee: form.extra_guest_fee ? parseFloat(form.extra_guest_fee) : null,
      }
      if (editing) {
        const res = await fetch('/api/booking/properties', {
          method: 'PUT', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: editing.id, ...body }),
        })
        const d = await res.json()
        if (!res.ok) { setSaveError(d.error ?? '儲存失敗'); return }
        if (d.property) setProperties(prev => prev.map(p => p.id === editing.id ? d.property : p))
      } else {
        const res = await fetch('/api/booking/properties', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        })
        const d = await res.json()
        if (!res.ok) { setSaveError(d.error ?? '儲存失敗'); return }
        if (d.property) setProperties(prev => [...prev, d.property])
      }
      setEditing(null); setAdding(false); setForm(EMPTY_FORM)
    } finally { setSaving(false) }
  }

  async function persistOrder(list: Property[]) {
    await Promise.all(list.map((p, i) =>
      p.sort_order === i ? null : fetch('/api/booking/properties', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: p.id, sort_order: i }),
      })
    ))
  }

  function handleDrop(targetId: string) {
    const fromId = dragId
    setDragId(null)
    if (!fromId || fromId === targetId) return
    setProperties(prev => {
      const list = [...prev]
      const fromIdx = list.findIndex(p => p.id === fromId)
      const toIdx = list.findIndex(p => p.id === targetId)
      if (fromIdx === -1 || toIdx === -1) return prev
      const [moved] = list.splice(fromIdx, 1)
      list.splice(toIdx, 0, moved)
      persistOrder(list)
      return list.map((p, i) => ({ ...p, sort_order: i }))
    })
  }

  async function del(id: string) {
    if (!confirm(t('properties.deleteConfirm'))) return
    await fetch('/api/booking/properties', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) })
    setProperties(prev => prev.filter(p => p.id !== id))
  }

  const isOpen = adding || editing !== null
  const TABS: { key: ModalTab; label: string }[] = [
    { key: 'basic',     label: t('properties.tabBasic') },
    { key: 'amenities', label: t('properties.tabAmenities') },
    { key: 'photos',    label: t('properties.tabPhotos') },
  ]

  return (
    <div className="p-4 md:p-6 pb-16 space-y-5 max-w-3xl">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-gray-900">{t('properties.title')}</h1>
          <p className="text-sm text-gray-500 mt-0.5">{t('properties.subtitle')}</p>
        </div>
        <button onClick={openAdd}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700">
          <Plus className="h-4 w-4" /> {t('properties.add')}
        </button>
      </div>

      {loading ? (
        <div className="text-center py-16 text-gray-400">{t('common.loading')}</div>
      ) : properties.length === 0 ? (
        <div className="text-center py-16 text-gray-400 space-y-2">
          <BedDouble className="h-10 w-10 mx-auto opacity-30" />
          <p className="text-sm">{t('properties.empty')}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3">
          {properties.map(p => (
            <div key={p.id}
              draggable
              onDragStart={e => { e.dataTransfer.effectAllowed = 'move'; setDragId(p.id) }}
              onDragOver={e => e.preventDefault()}
              onDrop={e => { e.preventDefault(); handleDrop(p.id) }}
              onDragEnd={() => setDragId(null)}
              className={`bg-white border rounded-xl p-4 flex items-start gap-4 transition-opacity ${dragId === p.id ? 'opacity-40' : ''}`}>
              <div className="pt-1 -ml-1 cursor-grab active:cursor-grabbing text-gray-300 hover:text-gray-500 shrink-0" title={t('properties.dragToReorder')}>
                <GripVertical className="h-4 w-4" />
              </div>
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
                    {p.status === 'active' ? t('properties.active') : t('properties.inactive')}
                  </span>
                </div>
                <div className="text-xs text-gray-500 mt-0.5">
                  {t('properties.roomsGuests', { rooms: p.room_count, guests: p.max_guests })}
                  {p.base_price && ` · ${p.currency} ${Number(p.base_price).toLocaleString()}${t('properties.perNight')}`}
                </div>
                {(p.amenities ?? []).length > 0 && (
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    {p.amenities.slice(0, 6).map(a => (
                      <span key={a} className="text-[10px] px-1.5 py-0.5 bg-gray-50 text-gray-600 border rounded-full">{amenityLabel(a)}</span>
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
              <h3 className="font-bold text-gray-900 mb-3">{editing ? t('properties.editTitle') : t('properties.addTitle')}</h3>
              {/* Tabs */}
              <div className="flex border-b gap-1">
                {TABS.map(tab => (
                  <button key={tab.key} onClick={() => setModalTab(tab.key)}
                    className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors -mb-px
                      ${modalTab === tab.key ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Tab content */}
            <div className="overflow-y-auto flex-1 px-5 py-4 space-y-3">

              {/* ── 基本資料 ── */}
              {modalTab === 'basic' && <>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-gray-600">{t('properties.form.name')}<span className="text-red-500">*</span></label>
                  <input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                    placeholder={t('properties.form.namePlaceholder')}
                    className="w-full text-sm border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-300" />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-gray-600">
                    {t('properties.form.aliases')}
                    <span className="ml-1 font-normal text-gray-400">{t('properties.form.aliasesHint')}</span>
                  </label>
                  <div className="flex gap-2">
                    <input value={aliasInput}
                      onChange={e => setAliasInput(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addAlias() } }}
                      placeholder={t('properties.form.aliasPlaceholder')}
                      className="flex-1 text-sm border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-300" />
                    <button onClick={addAlias} type="button"
                      className="px-3 py-2 rounded-lg bg-sky-600 text-white text-sm hover:bg-sky-700">
                      {t('properties.form.addAlias')}
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
                  <label className="text-xs font-medium text-gray-600">{t('properties.form.description')}</label>
                  <textarea value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
                    rows={2} className="w-full text-sm border rounded-lg px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-indigo-300" />
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-gray-600">{t('properties.form.roomCount')}</label>
                    <input type="number" min={1} value={form.room_count}
                      onChange={e => setForm(p => ({ ...p, room_count: parseInt(e.target.value) }))}
                      className="w-full text-sm border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-300" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-gray-600">{t('properties.form.maxGuests')}</label>
                    <input type="number" min={1} value={form.max_guests}
                      onChange={e => setForm(p => ({ ...p, max_guests: parseInt(e.target.value) }))}
                      className="w-full text-sm border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-300" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-gray-600">{t('properties.form.basePrice')}</label>
                    <input type="number" value={form.base_price}
                      onChange={e => setForm(p => ({ ...p, base_price: e.target.value }))}
                      placeholder="2000"
                      className="w-full text-sm border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-300" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-gray-600">{t('properties.form.extraFee')}</label>
                    <input type="number" value={form.extra_guest_fee}
                      onChange={e => setForm(p => ({ ...p, extra_guest_fee: e.target.value }))}
                      placeholder="500"
                      className="w-full text-sm border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-300" />
                  </div>
                </div>
              </>}

              {/* ── 設施 ── */}
              {modalTab === 'amenities' && (
                <div className="space-y-4">
                  <p className="text-xs text-gray-500">{t('properties.amenitiesHint')}</p>
                  {AMENITY_GROUPS.map(({ groupKey, items }) => (
                    <div key={groupKey}>
                      <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">{t(`amenityGroups.${groupKey}`)}</div>
                      <div className="flex flex-wrap gap-2">
                        {items.map(item => {
                          const checked = form.amenities.includes(item)
                          return (
                            <button key={item} type="button" onClick={() => toggleAmenity(item)}
                              className={`text-xs px-3 py-1.5 rounded-full border transition-colors
                                ${checked
                                  ? 'bg-indigo-600 text-white border-indigo-600'
                                  : 'bg-white text-gray-600 border-gray-300 hover:border-indigo-400'}`}>
                              {amenityLabel(item)}
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* ── 照片 ── */}
              {modalTab === 'photos' && (
                <div className="space-y-3">
                  <p className="text-xs text-gray-500">{t('properties.photosHint')}</p>
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                    {form.images.map((url, i) => (
                      <div key={url} className="relative aspect-square rounded-xl overflow-hidden border group">
                        <img src={url} alt={`photo-${i}`} className="w-full h-full object-cover" />
                        {i === 0 ? (
                          <span className="absolute top-1 left-1 text-[10px] bg-indigo-600 text-white px-1.5 py-0.5 rounded-full">{t('properties.cover')}</span>
                        ) : (
                          <button type="button" onClick={() => setCover(url)}
                            className="absolute bottom-1 left-1 right-1 text-[10px] bg-black/60 text-white py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity">
                            {t('properties.setCover')}
                          </button>
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
                      <span className="text-[10px] text-gray-400">{uploading ? t('properties.uploading') : t('properties.addPhoto')}</span>
                    </button>
                  </div>
                  <input ref={fileRef} type="file" accept="image/*" className="hidden"
                    onChange={e => { const f = e.target.files?.[0]; if (f) uploadPhoto(f); e.target.value = '' }} />
                </div>
              )}
            </div>

            {/* Footer buttons */}
            {saveError && (
              <div className="shrink-0 mx-5 mb-2 px-3 py-2 rounded-lg bg-red-50 text-red-600 text-xs">{saveError}</div>
            )}
            <div className="shrink-0 flex gap-2 px-5 py-4 border-t">
              <button onClick={() => { setAdding(false); setEditing(null) }}
                className="flex-1 py-2 rounded-xl text-sm border text-gray-600 hover:bg-gray-50">{t('bookings.form.cancel')}</button>
              <button onClick={save} disabled={!form.name.trim() || saving}
                className="flex-1 py-2 rounded-xl text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50">
                {saving ? t('bookings.form.saving') : t('detail.save')}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}
