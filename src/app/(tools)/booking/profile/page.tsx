'use client'
import { useEffect, useRef, useState } from 'react'
import { Save, Loader2, ImagePlus, X } from 'lucide-react'

interface BreakfastSettings {
  type: 'none' | 'included' | 'optional'
  price_per_person: number
  start_time: string
  end_time: string
  description: string
}
interface AddonService {
  id: string; name: string; enabled: boolean
  price: number; unit: 'per_trip' | 'per_stay' | 'per_night' | 'per_person'; note: string
}
interface BnbProfile {
  name: string; description: string; address: string; city: string
  phone: string; email: string; website: string; line_id: string
  check_in_time: string; check_out_time: string; min_nights: number
  house_rules: string; images: string[]
  breakfast: BreakfastSettings
  addon_services: AddonService[]
}

const DEFAULT_BREAKFAST: BreakfastSettings = {
  type: 'none', price_per_person: 0, start_time: '07:30', end_time: '09:30', description: '',
}
const DEFAULT_ADDONS: AddonService[] = [
  { id: 'shuttle',   name: '接送服務', enabled: false, price: 0, unit: 'per_trip',   note: '' },
  { id: 'baby_crib', name: '嬰兒床',   enabled: false, price: 0, unit: 'per_stay',   note: '' },
  { id: 'extra_bed', name: '加床',     enabled: false, price: 0, unit: 'per_night',  note: '' },
  { id: 'parking',   name: '停車位',   enabled: false, price: 0, unit: 'per_night',  note: '' },
]
const DEFAULT: BnbProfile = {
  name: '', description: '', address: '', city: '',
  phone: '', email: '', website: '', line_id: '',
  check_in_time: '15:00', check_out_time: '11:00', min_nights: 1,
  house_rules: '', images: [],
  breakfast: DEFAULT_BREAKFAST,
  addon_services: DEFAULT_ADDONS,
}

const UNIT_LABELS: Record<string, string> = {
  per_trip: '每趟', per_stay: '每次入住', per_night: '每晚', per_person: '每人',
}

export default function BnbProfilePage() {
  const [form, setForm]       = useState<BnbProfile>(DEFAULT)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving]   = useState(false)
  const [saved, setSaved]     = useState(false)
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    fetch('/api/booking/profile').then(r => r.json()).then(d => {
      if (d.profile) {
        const p = d.profile
        // Merge saved addon_services with defaults so new defaults always appear
        const savedAddons: AddonService[] = p.addon_services ?? []
        const mergedAddons = DEFAULT_ADDONS.map(def => {
          const saved = savedAddons.find(s => s.id === def.id)
          return saved ?? def
        })
        // Append any custom addons not in defaults
        const extra = savedAddons.filter(s => !DEFAULT_ADDONS.find(d => d.id === s.id))
        setForm({
          ...DEFAULT, ...p,
          images: p.images ?? [],
          breakfast: p.breakfast ?? DEFAULT_BREAKFAST,
          addon_services: [...mergedAddons, ...extra],
        })
      }
    }).finally(() => setLoading(false))
  }, [])

  function set<K extends keyof BnbProfile>(k: K, v: BnbProfile[K]) {
    setForm(f => ({ ...f, [k]: v }))
    setSaved(false)
  }

  function setBreakfast(updates: Partial<BreakfastSettings>) {
    setForm(f => ({ ...f, breakfast: { ...f.breakfast, ...updates } }))
    setSaved(false)
  }

  function updateAddon(id: string, updates: Partial<AddonService>) {
    setForm(f => ({
      ...f,
      addon_services: f.addon_services.map(s => s.id === id ? { ...s, ...updates } : s),
    }))
    setSaved(false)
  }

  async function uploadPhoto(file: File) {
    setUploading(true)
    try {
      const fd = new FormData(); fd.append('file', file)
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
      const res = await fetch('/api/booking/profile', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const d = await res.json()
      if (d.profile) { setSaved(true) }
      else alert(d.error)
    } finally { setSaving(false) }
  }

  if (loading) return <div className="p-6 text-gray-400 text-sm">載入中…</div>

  const { breakfast, addon_services } = form

  return (
    <div className="p-4 md:p-6 pb-16 max-w-2xl space-y-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-gray-900">民宿基本資料</h1>
          <p className="text-sm text-gray-500 mt-0.5">設定民宿名稱、聯絡方式與入住規則</p>
        </div>
        <button onClick={save} disabled={saving}
          className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 disabled:opacity-50">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          {saved ? '已儲存 ✓' : '儲存'}
        </button>
      </div>

      {/* 基本資訊 */}
      <section className="bg-white rounded-xl border p-4 sm:p-5 space-y-4">
        <h2 className="text-sm font-semibold text-gray-700">基本資訊</h2>
        <div className="space-y-1">
          <label className="text-xs font-medium text-gray-600">民宿名稱 <span className="text-red-500">*</span></label>
          <input value={form.name} onChange={e => set('name', e.target.value)}
            placeholder="例：宜蘭 CIAO 民宿"
            className="w-full text-sm border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-300" />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-gray-600">民宿介紹</label>
          <textarea value={form.description} onChange={e => set('description', e.target.value)}
            rows={3} placeholder="簡短描述民宿特色…"
            className="w-full text-sm border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-300 resize-none" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-xs font-medium text-gray-600">縣市</label>
            <input value={form.city} onChange={e => set('city', e.target.value)}
              placeholder="宜蘭縣"
              className="w-full text-sm border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-300" />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-gray-600">地址</label>
            <input value={form.address} onChange={e => set('address', e.target.value)}
              placeholder="詳細地址"
              className="w-full text-sm border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-300" />
          </div>
        </div>
      </section>

      {/* 聯絡方式 */}
      <section className="bg-white rounded-xl border p-4 sm:p-5 space-y-4">
        <h2 className="text-sm font-semibold text-gray-700">聯絡方式</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {[
            { key: 'phone',   label: '電話',      placeholder: '0912-345-678' },
            { key: 'email',   label: '聯絡 Email', placeholder: 'info@example.com' },
            { key: 'website', label: '官網',       placeholder: 'https://...' },
            { key: 'line_id', label: 'LINE ID',    placeholder: '@ciaohome' },
          ].map(({ key, label, placeholder }) => (
            <div key={key} className="space-y-1">
              <label className="text-xs font-medium text-gray-600">{label}</label>
              <input value={form[key as keyof BnbProfile] as string}
                onChange={e => set(key as keyof BnbProfile, e.target.value as never)}
                placeholder={placeholder}
                className="w-full text-sm border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-300" />
            </div>
          ))}
        </div>
      </section>

      {/* 入住規則 */}
      <section className="bg-white rounded-xl border p-4 sm:p-5 space-y-4">
        <h2 className="text-sm font-semibold text-gray-700">入住規則</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="space-y-1">
            <label className="text-xs font-medium text-gray-600">入住時間</label>
            <input value={form.check_in_time} onChange={e => set('check_in_time', e.target.value)}
              placeholder="15:00"
              className="w-full text-sm border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-300" />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-gray-600">退房時間</label>
            <input value={form.check_out_time} onChange={e => set('check_out_time', e.target.value)}
              placeholder="11:00"
              className="w-full text-sm border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-300" />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-gray-600">最少入住晚數</label>
            <input type="number" min={1} value={form.min_nights}
              onChange={e => set('min_nights', parseInt(e.target.value) || 1)}
              className="w-full text-sm border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-300" />
          </div>
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-gray-600">住宿規則</label>
          <textarea value={form.house_rules} onChange={e => set('house_rules', e.target.value)}
            rows={4} placeholder="禁止吸菸、禁止攜帶寵物、請保持安靜…"
            className="w-full text-sm border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-300 resize-none" />
        </div>
      </section>

      {/* 早餐設定 */}
      <section className="bg-white rounded-xl border p-4 sm:p-5 space-y-4">
        <h2 className="text-sm font-semibold text-gray-700">早餐設定</h2>

        <div className="flex gap-2">
          {(['none','included','optional'] as const).map(t => (
            <button key={t} type="button" onClick={() => setBreakfast({ type: t })}
              className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-colors
                ${breakfast.type === t
                  ? 'bg-indigo-600 text-white border-indigo-600'
                  : 'bg-white text-gray-600 border-gray-300 hover:border-indigo-400'}`}>
              {t === 'none' ? '不提供' : t === 'included' ? '含早餐' : '早餐加購'}
            </button>
          ))}
        </div>

        {breakfast.type !== 'none' && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-medium text-gray-600">供應開始</label>
                <input value={breakfast.start_time} onChange={e => setBreakfast({ start_time: e.target.value })}
                  placeholder="07:30"
                  className="w-full text-sm border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-300" />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-gray-600">供應結束</label>
                <input value={breakfast.end_time} onChange={e => setBreakfast({ end_time: e.target.value })}
                  placeholder="09:30"
                  className="w-full text-sm border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-300" />
              </div>
            </div>
            {breakfast.type === 'optional' && (
              <div className="space-y-1">
                <label className="text-xs font-medium text-gray-600">加購價格（/人）</label>
                <div className="flex items-center gap-2">
                  <input type="number" min={0} value={breakfast.price_per_person}
                    onChange={e => setBreakfast({ price_per_person: parseFloat(e.target.value) || 0 })}
                    placeholder="200"
                    className="w-32 text-sm border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-300" />
                  <span className="text-xs text-gray-400">元/人</span>
                </div>
              </div>
            )}
            <div className="space-y-1">
              <label className="text-xs font-medium text-gray-600">早餐說明</label>
              <textarea value={breakfast.description}
                onChange={e => setBreakfast({ description: e.target.value })}
                rows={2} placeholder="西式早餐，含咖啡或茶…"
                className="w-full text-sm border rounded-lg px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-indigo-300" />
            </div>
          </div>
        )}
      </section>

      {/* 加購服務 */}
      <section className="bg-white rounded-xl border p-4 sm:p-5 space-y-3">
        <h2 className="text-sm font-semibold text-gray-700">加購服務</h2>
        <p className="text-xs text-gray-400">開啟後，填寫訂單時可幫旅客勾選加購項目</p>
        <div className="divide-y">
          {addon_services.map(svc => (
            <div key={svc.id} className="py-3 space-y-2">
              <div className="flex items-center gap-3">
                <button type="button" onClick={() => updateAddon(svc.id, { enabled: !svc.enabled })}
                  className={`relative w-10 h-5 rounded-full transition-colors shrink-0
                    ${svc.enabled ? 'bg-indigo-600' : 'bg-gray-300'}`}>
                  <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform
                    ${svc.enabled ? 'translate-x-5' : ''}`} />
                </button>
                <span className="text-sm font-medium text-gray-700">{svc.name}</span>
              </div>
              {svc.enabled && (
                <div className="ml-[52px] grid grid-cols-2 sm:grid-cols-3 gap-2">
                  <div className="space-y-1">
                    <label className="text-[11px] text-gray-500">價格</label>
                    <div className="flex items-center gap-1">
                      <input type="number" min={0} value={svc.price}
                        onChange={e => updateAddon(svc.id, { price: parseFloat(e.target.value) || 0 })}
                        placeholder="0"
                        className="w-full text-sm border rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-300" />
                      <span className="text-xs text-gray-400 shrink-0">元</span>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[11px] text-gray-500">計費單位</label>
                    <select value={svc.unit} onChange={e => updateAddon(svc.id, { unit: e.target.value as AddonService['unit'] })}
                      className="w-full text-sm border rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-300 bg-white">
                      {Object.entries(UNIT_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                    </select>
                  </div>
                  <div className="space-y-1 col-span-2 sm:col-span-1">
                    <label className="text-[11px] text-gray-500">備註</label>
                    <input value={svc.note} onChange={e => updateAddon(svc.id, { note: e.target.value })}
                      placeholder="例：需提前24小時預約"
                      className="w-full text-sm border rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-300" />
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* 民宿照片 */}
      <section className="bg-white rounded-xl border p-4 sm:p-5 space-y-3">
        <h2 className="text-sm font-semibold text-gray-700">民宿照片</h2>
        <p className="text-xs text-gray-400">上傳民宿整體環境照片，第一張為主圖</p>
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
          {form.images.map((url, i) => (
            <div key={url} className="relative aspect-square rounded-xl overflow-hidden border group">
              <img src={url} alt={`photo-${i}`} className="w-full h-full object-cover" />
              {i === 0 && (
                <span className="absolute top-1 left-1 text-[10px] bg-indigo-600 text-white px-1.5 py-0.5 rounded-full">主圖</span>
              )}
              <button onClick={() => removePhoto(url)}
                className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/60 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
          <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading}
            className="aspect-square rounded-xl border-2 border-dashed border-gray-300 flex flex-col items-center justify-center gap-1 hover:border-indigo-400 transition-colors">
            {uploading ? <Loader2 className="h-5 w-5 animate-spin text-gray-400" /> : <ImagePlus className="h-5 w-5 text-gray-400" />}
            <span className="text-[10px] text-gray-400">{uploading ? '上傳中…' : '新增照片'}</span>
          </button>
        </div>
        <input ref={fileRef} type="file" accept="image/*" className="hidden"
          onChange={e => { const f = e.target.files?.[0]; if (f) uploadPhoto(f); e.target.value = '' }} />
      </section>

      <div className="text-xs text-gray-400 pb-4">
        民宿名稱會用於 Email 擷取時自動識別訂單來源，請確保與各平台上的名稱一致。
      </div>
    </div>
  )
}
