'use client'

import { useState, useEffect, use, useRef } from 'react'
import {
  Zap, Droplets, Flame, Snowflake, Truck, Upload, CheckCircle2,
  AlertCircle, Loader2, Image as ImageIcon, FileText, Check,
  ExternalLink, Calendar, Building2, MapPin, Hash, Plus
} from 'lucide-react'

interface VStore {
  code: string
  name: string
  region: string
  unit_type?: string
  electricity_no?: string
  water_no?: string
  address?: string
}

interface StoreDetail {
  amount: number
  receipt_url?: string
  cylinders?: string
  note?: string
  source?: string
}

const fmt = (n: number) => Math.round(Number(n) || 0).toLocaleString('zh-TW')

const SERVICE_META: Record<string, { label: string; icon: any; color: string; bg: string }> = {
  electric: { label: '電力公司', icon: Zap, color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-100 dark:bg-amber-950/60' },
  water: { label: '自來水公司', icon: Droplets, color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-100 dark:bg-blue-950/60' },
  gas: { label: '瓦斯公司', icon: Flame, color: 'text-orange-600 dark:text-orange-400', bg: 'bg-orange-100 dark:bg-orange-950/60' },
  ice: { label: '冰塊供應商', icon: Snowflake, color: 'text-cyan-600 dark:text-cyan-400', bg: 'bg-cyan-100 dark:bg-cyan-950/60' },
}

export default function VendorFillPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params)
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [vendor, setVendor] = useState<{ name: string; service: string; regions?: string[] } | null>(null)
  const [category, setCategory] = useState<{ code: string; name: string } | null>(null)
  const [stores, setStores] = useState<VStore[]>([])
  const [amounts, setAmounts] = useState<Record<string, number>>({})
  const [details, setDetails] = useState<Record<string, StoreDetail>>({})
  const [masterReceiptUrl, setMasterReceiptUrl] = useState<string>('')
  const [uploadingMaster, setUploadingMaster] = useState(false)
  const [uploadingStore, setUploadingStore] = useState<string | null>(null)

  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const masterFileRef = useRef<HTMLInputElement>(null)
  const storeFileRefs = useRef<Record<string, HTMLInputElement | null>>({})

  // 載入廠商資訊、涵蓋門市與本期金額
  useEffect(() => {
    let alive = true
    setLoading(true)
    setSaved(false)
    setMsg(null)

    fetch(`/api/fin/vendor/${token}?year=${year}&month=${month}`)
      .then(r => (r.ok ? r.json() : null))
      .then(d => {
        if (!alive) return
        if (!d) {
          setNotFound(true)
          setLoading(false)
          return
        }
        setVendor(d.vendor)
        setCategory(d.category)
        setStores(d.stores ?? [])
        setAmounts(d.amounts ?? {})
        setDetails(d.details ?? {})
        setLoading(false)
      })
      .catch(() => {
        if (alive) {
          setNotFound(true)
          setLoading(false)
        }
      })

    return () => { alive = false }
  }, [token, year, month])

  // 上傳單據檔案（可為單店單據，亦可為整批總帳單）
  const handleUpload = async (file: File, storeCode?: string) => {
    if (storeCode) setUploadingStore(storeCode)
    else setUploadingMaster(true)

    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await fetch(`/api/fin/bills/upload?token=${encodeURIComponent(token)}`, {
        method: 'POST',
        body: fd,
      })
      const data = await res.json()
      if (res.ok && data.url) {
        if (storeCode) {
          setDetails(prev => ({
            ...prev,
            [storeCode]: {
              ...(prev[storeCode] || { amount: amounts[storeCode] || 0 }),
              receipt_url: data.url,
            }
          }))
          setMsg({ type: 'success', text: `門市 [${storeCode}] 單據上傳成功！` })
        } else {
          setMasterReceiptUrl(data.url)
          setMsg({ type: 'success', text: '本期總帳單／統一發票上傳成功！' })
        }
      } else {
        setMsg({ type: 'error', text: data.error || '單據上傳失敗' })
      }
    } catch {
      setMsg({ type: 'error', text: '上傳網路異常，請重試' })
    } finally {
      if (storeCode) setUploadingStore(null)
      else setUploadingMaster(false)
    }
  }

  // 提交所有金額與單據
  const submit = async () => {
    setSaving(true)
    setMsg(null)
    try {
      const res = await fetch(`/api/fin/vendor/${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          year,
          month,
          amounts,
          details,
          master_receipt_url: masterReceiptUrl,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (res.ok) {
        setSaved(true)
        setMsg({ type: 'success', text: `✅ 費用與單據憑證已成功送出（共 ${data.saved || 0} 家門市據點），出納總務已即時串接入帳！` })
        setTimeout(() => setSaved(false), 3500)
      } else {
        setMsg({ type: 'error', text: data.error || '送出失敗，請確認內容後重試' })
      }
    } catch {
      setMsg({ type: 'error', text: '送出失敗，請檢查網路連線' })
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="text-center space-y-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
          <p className="text-sm font-medium text-slate-600">正在載入填報系統資料…</p>
        </div>
      </div>
    )
  }

  if (notFound || !vendor) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="text-center space-y-3 max-w-sm bg-white p-8 rounded-2xl shadow-sm border">
          <AlertCircle className="h-10 w-10 text-rose-500 mx-auto" />
          <h2 className="text-lg font-bold text-slate-900">連結無效或已停用</h2>
          <p className="text-xs text-slate-500">
            此私密填報連結可能已被管理員停用或不存在，請聯繫出納總務單位以取得最新專屬連結。
          </p>
        </div>
      </div>
    )
  }

  const meta = SERVICE_META[vendor.service] || {
    label: '廠商',
    icon: Truck,
    color: 'text-indigo-600 dark:text-indigo-400',
    bg: 'bg-indigo-100 dark:bg-indigo-950/60',
  }
  const SvcIcon = meta.icon

  const total = stores.reduce((s, st) => s + (amounts[st.code] || 0), 0)
  const byRegion: Record<string, VStore[]> = {}
  for (const st of stores) {
    const rKey = st.region || '全區 / 未分區'
    if (!byRegion[rKey]) byRegion[rKey] = []
    byRegion[rKey].push(st)
  }

  return (
    <div className="min-h-screen bg-slate-50/80 py-8 px-4 sm:px-6">
      <div className="max-w-3xl mx-auto space-y-6">
        {/* 頂部標題卡 */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200/80 space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <div className={`w-12 h-12 rounded-2xl ${meta.bg} flex items-center justify-center ${meta.color} shadow-sm`}>
                <SvcIcon className="h-6 w-6" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-xl font-bold text-slate-900">{vendor.name}</h1>
                  <span className={`text-[11px] px-2.5 py-0.5 rounded-full font-semibold ${meta.bg} ${meta.color}`}>
                    {meta.label}專屬填報端
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  {vendor.service === 'electric' && '⚡ 單一電力公司・涵蓋全門市、工廠、辦公室電費帳單填報'}
                  {vendor.service === 'water' && '💧 單一自來水公司・涵蓋全門市、工廠、辦公室水費帳單填報'}
                  {vendor.service === 'gas' && `🔥 區域瓦斯專供・負責區域：${vendor.regions && vendor.regions.length ? vendor.regions.join('、') : '全據點'}・支援瓦斯簽收單／發票單據上傳`}
                  {vendor.service === 'ice' && `🧊 冰塊配送・負責區域：${vendor.regions && vendor.regions.length ? vendor.regions.join('、') : '全部'}`}
                </p>
              </div>
            </div>

            {/* 月份切換 */}
            <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-xl">
              <select
                value={year}
                onChange={e => setYear(Number(e.target.value))}
                className="h-8 rounded-lg bg-white px-2.5 text-xs font-semibold border-none shadow-xs text-slate-700 focus:ring-1 focus:ring-primary"
              >
                {[now.getFullYear(), now.getFullYear() - 1].map(y => (
                  <option key={y} value={y}>{y} 年</option>
                ))}
              </select>
              <select
                value={month}
                onChange={e => setMonth(Number(e.target.value))}
                className="h-8 rounded-lg bg-white px-2.5 text-xs font-semibold border-none shadow-xs text-slate-700 focus:ring-1 focus:ring-primary"
              >
                {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                  <option key={m} value={m}>{m} 月</option>
                ))}
              </select>
            </div>
          </div>

          {/* 總帳單/統一發票單據上傳（公用事業或整批廠商可一次上傳） */}
          <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="space-y-0.5">
              <span className="font-semibold text-slate-800">
                {vendor.service === 'electric' || vendor.service === 'water' ? '全據點月度總帳單／總發票（可選）' : '整批發票／送貨明細憑證（可選）'}
              </span>
              <p className="text-slate-500 text-[11px]">
                若有多家門市開立在同一張統編發票或總結算單上，可直接在此上傳一張總帳單。
              </p>
            </div>

            <input
              ref={masterFileRef}
              type="file"
              accept="image/*,.pdf"
              className="hidden"
              onChange={e => {
                const f = e.target.files?.[0]
                if (f) handleUpload(f)
              }}
            />

            {masterReceiptUrl ? (
              <div className="flex items-center gap-2 bg-emerald-50 text-emerald-800 border border-emerald-200 px-3 py-1.5 rounded-lg">
                <Check className="h-3.5 w-3.5 text-emerald-600" />
                <span className="font-medium text-[11px]">總單據已上傳</span>
                <a
                  href={masterReceiptUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="underline text-primary text-[11px] inline-flex items-center gap-0.5"
                >
                  查看 <ExternalLink className="h-2.5 w-2.5" />
                </a>
                <button
                  type="button"
                  onClick={() => masterFileRef.current?.click()}
                  className="text-[11px] text-slate-500 hover:text-slate-800 underline ml-1"
                >
                  更換
                </button>
              </div>
            ) : (
              <button
                type="button"
                disabled={uploadingMaster}
                onClick={() => masterFileRef.current?.click()}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 font-medium text-xs transition-colors shadow-xs"
              >
                {uploadingMaster ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5 text-slate-500" />}
                上傳整期總發票/帳單 (PDF/圖片)
              </button>
            )}
          </div>
        </div>

        {/* 提示訊息 */}
        {msg && (
          <div
            className={`p-3.5 rounded-xl border flex items-center gap-2.5 text-sm font-medium ${
              msg.type === 'success'
                ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                : 'bg-rose-50 text-rose-800 border-rose-200'
            }`}
          >
            {msg.type === 'success' ? (
              <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="h-5 w-5 text-rose-600 shrink-0" />
            )}
            <span>{msg.text}</span>
            <button onClick={() => setMsg(null)} className="ml-auto text-xs opacity-70 hover:opacity-100">✕</button>
          </div>
        )}

        {!category && (
          <div className="bg-amber-50 border border-amber-200 text-amber-800 rounded-xl p-4 text-xs">
            ⚠️ 後台出納系統尚未關聯對應之費用科目，請聯繫該品牌出納總務確認。
          </div>
        )}

        {stores.length === 0 && category && (
          <div className="bg-white rounded-2xl p-8 text-center text-slate-500 text-sm border shadow-sm">
            目前此服務別或負責區域內尚無分配之門市據點。
          </div>
        )}

        {/* 門市填報清單（依區域分組） */}
        {Object.entries(byRegion).map(([region, list]) => (
          <div key={region} className="space-y-3">
            <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700 px-1">
              <MapPin className="h-3.5 w-3.5 text-slate-400" />
              <span>{region}</span>
              <span className="text-slate-400 font-normal">（共 {list.length} 家據點）</span>
            </div>

            <div className="space-y-2.5">
              {list.map(st => {
                const dt = details[st.code] || {}
                const stReceipt = dt.receipt_url || ''

                return (
                  <div
                    key={st.code}
                    className="bg-white rounded-xl p-4 border border-slate-200/80 shadow-sm hover:border-slate-300 transition-colors space-y-3"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-900 text-sm">
                          {st.name || st.code}
                        </span>
                        <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-slate-100 text-slate-600">
                          {st.code}
                        </span>
                        {st.unit_type && st.unit_type !== 'store' && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200">
                            {st.unit_type === 'factory' ? '工廠' : st.unit_type === 'office' ? '總部辦公室' : st.unit_type}
                          </span>
                        )}
                      </div>

                      {/* 電號／水號 輔助識別 */}
                      <div className="flex items-center gap-3 text-xs text-slate-500">
                        {vendor.service === 'electric' && (
                          <span className="flex items-center gap-1">
                            <Zap className="h-3.5 w-3.5 text-amber-500" />
                            電號：<b className="font-mono text-slate-800">{st.electricity_no || '未登錄'}</b>
                          </span>
                        )}
                        {vendor.service === 'water' && (
                          <span className="flex items-center gap-1">
                            <Droplets className="h-3.5 w-3.5 text-blue-500" />
                            水號：<b className="font-mono text-slate-800">{st.water_no || '未登錄'}</b>
                          </span>
                        )}
                      </div>
                    </div>

                    {/* 金額與單據填報行 */}
                    <div className="grid sm:grid-cols-12 gap-3 items-center">
                      {/* 瓦斯叫桶數量（若是瓦斯公司） */}
                      {vendor.service === 'gas' && (
                        <div className="sm:col-span-4 space-y-1">
                          <label className="text-[11px] font-medium text-slate-500">瓦斯規格/桶數 (可選)</label>
                          <input
                            type="text"
                            placeholder="例: 50kg 2 桶"
                            value={dt.cylinders || ''}
                            onChange={e => {
                              const val = e.target.value
                              setDetails(prev => ({
                                ...prev,
                                [st.code]: {
                                  ...(prev[st.code] || { amount: amounts[st.code] || 0 }),
                                  cylinders: val,
                                }
                              }))
                            }}
                            className="w-full h-9 rounded-lg border border-slate-200 px-2.5 text-xs text-slate-800 focus:ring-1 focus:ring-primary"
                          />
                        </div>
                      )}

                      {/* 金額輸入框 */}
                      <div className={`${vendor.service === 'gas' ? 'sm:col-span-4' : 'sm:col-span-6'} space-y-1`}>
                        <label className="text-[11px] font-medium text-slate-500 flex items-center justify-between">
                          <span>應繳金額 (VND) *</span>
                          {(amounts[st.code] || 0) > 0 && (
                            <span className="text-[10px] text-slate-400 font-mono">
                              {fmt(amounts[st.code])} VND
                            </span>
                          )}
                        </label>
                        <div className="relative">
                          <input
                            type="number"
                            inputMode="numeric"
                            placeholder="0"
                            value={amounts[st.code] ?? ''}
                            disabled={!category}
                            onChange={e => {
                              const val = Number(e.target.value) || 0
                              setAmounts(p => ({ ...p, [st.code]: val }))
                              setDetails(prev => ({
                                ...prev,
                                [st.code]: {
                                  ...(prev[st.code] || {}),
                                  amount: val,
                                }
                              }))
                            }}
                            className="w-full h-9 rounded-lg border border-slate-200 px-3 pr-8 font-mono text-sm font-bold text-right text-slate-800 focus:ring-2 focus:ring-primary"
                          />
                          <span className="absolute right-2.5 top-2 text-xs text-slate-400 font-normal">₫</span>
                        </div>
                      </div>

                      {/* 單店單據／簽收單照片上傳 */}
                      <div className={`${vendor.service === 'gas' ? 'sm:col-span-4' : 'sm:col-span-6'} space-y-1`}>
                        <label className="text-[11px] font-medium text-slate-500">
                          {vendor.service === 'gas' ? '瓦斯簽收單／發票憑證' : '本據點繳費單據照片'}
                        </label>

                        <input
                          ref={el => { storeFileRefs.current[st.code] = el }}
                          type="file"
                          accept="image/*,.pdf"
                          className="hidden"
                          onChange={e => {
                            const f = e.target.files?.[0]
                            if (f) handleUpload(f, st.code)
                          }}
                        />

                        {stReceipt ? (
                          <div className="h-9 flex items-center justify-between gap-1.5 px-2.5 rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-800 text-xs">
                            <span className="flex items-center gap-1 font-medium truncate">
                              <Check className="h-3.5 w-3.5 text-emerald-600 shrink-0" />已上傳單據
                            </span>
                            <div className="flex items-center gap-2 shrink-0">
                              <a
                                href={stReceipt}
                                target="_blank"
                                rel="noreferrer"
                                className="text-primary underline text-[11px] inline-flex items-center gap-0.5"
                              >
                                檢視 <ExternalLink className="h-2.5 w-2.5" />
                              </a>
                              <button
                                type="button"
                                onClick={() => storeFileRefs.current[st.code]?.click()}
                                className="text-[11px] text-slate-500 hover:text-slate-800 underline"
                              >
                                更換
                              </button>
                            </div>
                          </div>
                        ) : (
                          <button
                            type="button"
                            disabled={uploadingStore === st.code}
                            onClick={() => storeFileRefs.current[st.code]?.click()}
                            className="w-full h-9 rounded-lg border border-dashed border-slate-300 hover:border-slate-400 hover:bg-slate-50 flex items-center justify-center gap-1.5 text-xs text-slate-600 transition-colors"
                          >
                            {uploadingStore === st.code ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
                            ) : (
                              <Upload className="h-3.5 w-3.5 text-slate-400" />
                            )}
                            <span>拍照或上傳單據</span>
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        ))}

        {/* 底部浮動合計與送出列 */}
        {category && stores.length > 0 && (
          <div className="sticky bottom-4 z-10 bg-white/95 backdrop-blur-md rounded-2xl p-4 shadow-xl border border-slate-200 flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="text-xs text-slate-500">
                本期合計（{year} 年 {month} 月・共 {stores.length} 家據點）
              </div>
              <div className="text-2xl font-bold font-mono text-slate-900">
                {fmt(total)} <span className="text-sm font-normal text-slate-500">VND</span>
              </div>
            </div>

            <button
              onClick={submit}
              disabled={saving}
              className={`h-11 px-6 rounded-xl font-bold text-sm text-white shadow-md flex items-center gap-2 transition-all ${
                saved
                  ? 'bg-emerald-600 hover:bg-emerald-700'
                  : 'bg-primary hover:bg-primary/90'
              }`}
            >
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />送出處理中…
                </>
              ) : saved ? (
                <>
                  <CheckCircle2 className="h-4 w-4" />已成功送出 ✓
                </>
              ) : (
                <>
                  <Check className="h-4 w-4" />確認送出並串接觸納總務
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
