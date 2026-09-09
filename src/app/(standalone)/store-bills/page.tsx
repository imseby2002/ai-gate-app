'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import Link from 'next/link'
import {
  Zap, Droplets, Receipt, Upload, CheckCircle2, AlertCircle,
  Loader2, Image as ImageIcon, Store, Calendar, ArrowRight,
  RefreshCw, FileText, Check, ExternalLink, Flame, Wifi, Plus
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'

const fmt = (n: number) => Math.round(Number(n) || 0).toLocaleString('zh-TW')

interface StoreItem {
  code: string
  name: string
  region: string
  electricity_no?: string
  water_no?: string
}

interface BillRecord {
  store_code: string
  category_code: string
  amount: number
  source: string
  note?: string
  updated_at?: string
}

export default function StoreBillsPage() {
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [stores, setStores] = useState<StoreItem[]>([])
  const [selectedStore, setSelectedStore] = useState('')
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [uploadingElec, setUploadingElec] = useState(false)
  const [uploadingWater, setUploadingWater] = useState(false)
  const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  // 電費狀態
  const [elecAmount, setElecAmount] = useState<string>('')
  const [elecReceiptUrl, setElecReceiptUrl] = useState<string>('')
  const [elecNote, setElecNote] = useState<string>('')

  // 水費狀態
  const [waterAmount, setWaterAmount] = useState<string>('')
  const [waterReceiptUrl, setWaterReceiptUrl] = useState<string>('')
  const [waterNote, setWaterNote] = useState<string>('')

  // 瓦斯狀態（可選）
  const [gasAmount, setGasAmount] = useState<string>('')
  const [gasNote, setGasNote] = useState<string>('')

  // 已送出之本期紀錄
  const [currentBills, setCurrentBills] = useState<BillRecord[]>([])

  const elecFileRef = useRef<HTMLInputElement>(null)
  const waterFileRef = useRef<HTMLInputElement>(null)

  // 載入門市與本期帳單
  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/fin/bills?year=${year}&month=${month}${selectedStore ? `&store_code=${encodeURIComponent(selectedStore)}` : ''}`)
      if (res.ok) {
        const d = await res.json()
        const stList: StoreItem[] = d.stores ?? []
        setStores(stList)
        if (!selectedStore && stList.length > 0) {
          setSelectedStore(stList[0].code)
        }

        const bills: BillRecord[] = d.bills ?? []
        setCurrentBills(bills)

        // 若已選門市，帶入既有資料
        if (selectedStore) {
          const eBill = bills.find(b => b.store_code === selectedStore && b.category_code === 'ELEC')
          if (eBill) {
            setElecAmount(String(eBill.amount || ''))
            try {
              const parsed = JSON.parse(eBill.note || '{}')
              if (parsed.receipt_url) setElecReceiptUrl(parsed.receipt_url)
              if (parsed.note) setElecNote(parsed.note)
            } catch {
              setElecNote(eBill.note || '')
            }
          } else {
            setElecAmount('')
            setElecReceiptUrl('')
            setElecNote('')
          }

          const wBill = bills.find(b => b.store_code === selectedStore && b.category_code === 'WATER')
          if (wBill) {
            setWaterAmount(String(wBill.amount || ''))
            try {
              const parsed = JSON.parse(wBill.note || '{}')
              if (parsed.receipt_url) setWaterReceiptUrl(parsed.receipt_url)
              if (parsed.note) setWaterNote(parsed.note)
            } catch {
              setWaterNote(wBill.note || '')
            }
          } else {
            setWaterAmount('')
            setWaterReceiptUrl('')
            setWaterNote('')
          }

          const gBill = bills.find(b => b.store_code === selectedStore && b.category_code === 'GAS')
          if (gBill) {
            setGasAmount(String(gBill.amount || ''))
            setGasNote(gBill.note || '')
          } else {
            setGasAmount('')
            setGasNote('')
          }
        }
      }
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }, [year, month, selectedStore])

  useEffect(() => {
    loadData()
  }, [loadData])

  // 上傳單據附件
  const handleFileUpload = async (file: File, type: 'elec' | 'water') => {
    const isElec = type === 'elec'
    if (isElec) setUploadingElec(true)
    else setUploadingWater(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await fetch('/api/fin/bills/upload', {
        method: 'POST',
        body: fd,
      })
      const data = await res.json()
      if (res.ok && data.url) {
        if (isElec) setElecReceiptUrl(data.url)
        else setWaterReceiptUrl(data.url)
        setMsg({ type: 'success', text: `${isElec ? '電費' : '水費'}單據已成功上傳！` })
      } else {
        setMsg({ type: 'error', text: data.error || '單據上傳失敗' })
      }
    } catch {
      setMsg({ type: 'error', text: '上傳失敗，請檢查網路連線' })
    } finally {
      if (isElec) setUploadingElec(false)
      else setUploadingWater(false)
    }
  }

  // 提交申報至出納
  const handleSubmit = async () => {
    if (!selectedStore) {
      setMsg({ type: 'error', text: '請選擇門市' })
      return
    }

    setSubmitting(true)
    setMsg(null)

    try {
      const tasks = []

      // 1. 電費
      if (elecAmount !== '' || elecReceiptUrl) {
        const notePayload = JSON.stringify({
          receipt_url: elecReceiptUrl || '',
          note: elecNote || '',
          submitted_at: new Date().toISOString(),
        })
        tasks.push(
          fetch('/api/fin/bills', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              store_code: selectedStore,
              category_code: 'ELEC',
              year,
              month,
              amount: Number(elecAmount) || 0,
              source: 'store_upload',
              note: notePayload,
            }),
          })
        )
      }

      // 2. 水費
      if (waterAmount !== '' || waterReceiptUrl) {
        const notePayload = JSON.stringify({
          receipt_url: waterReceiptUrl || '',
          note: waterNote || '',
          submitted_at: new Date().toISOString(),
        })
        tasks.push(
          fetch('/api/fin/bills', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              store_code: selectedStore,
              category_code: 'WATER',
              year,
              month,
              amount: Number(waterAmount) || 0,
              source: 'store_upload',
              note: notePayload,
            }),
          })
        )
      }

      // 3. 瓦斯（若有填寫）
      if (gasAmount !== '') {
        tasks.push(
          fetch('/api/fin/bills', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              store_code: selectedStore,
              category_code: 'GAS',
              year,
              month,
              amount: Number(gasAmount) || 0,
              source: 'store_upload',
              note: gasNote || '',
            }),
          })
        )
      }

      const results = await Promise.all(tasks)
      const hasError = results.some(r => !r.ok)

      if (hasError) {
        setMsg({ type: 'error', text: '部分費用送出失敗，請重試' })
      } else {
        setMsg({ type: 'success', text: '✅ 門市水電費用已成功提交！數據已即時串接到出納總務之收支與損益報表。' })
        loadData()
      }
    } catch {
      setMsg({ type: 'error', text: '提報失敗，請確認網路連線' })
    } finally {
      setSubmitting(false)
    }
  }

  const currentStoreObj = stores.find(s => s.code === selectedStore)

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      {/* 頂部標題 */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b pb-4">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center text-white shadow-md">
            <Receipt className="h-6 w-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight">門市水電費用填報</h1>
              <span className="text-[11px] px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 font-medium">
                自動串接觸納總務
              </span>
            </div>
            <p className="text-sm text-muted-foreground">
              各分店每月電費、水費與單據照片上傳；提交後即時匯入出納總務每店損益與收支報表
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Link href="/store-inventory">
            <Button variant="outline" size="sm" className="gap-1.5 text-xs">
              <Store className="h-3.5 w-3.5" />盤點・訂貨
            </Button>
          </Link>
          <Link href="/repair">
            <Button variant="outline" size="sm" className="gap-1.5 text-xs text-amber-700 dark:text-amber-400">
              <Plus className="h-3.5 w-3.5" />門市報修
            </Button>
          </Link>
        </div>
      </div>

      {/* 門市與年月選取器 */}
      <Card className="p-4 bg-card/60 border shadow-sm">
        <div className="flex flex-wrap items-center gap-4">
          <div className="space-y-1 flex-1 min-w-[200px]">
            <label className="text-xs font-semibold text-gray-700 dark:text-gray-300">
              申報門市 (Store)
            </label>
            <select
              value={selectedStore}
              onChange={e => setSelectedStore(e.target.value)}
              className="w-full h-10 rounded-lg border bg-background px-3 text-sm font-medium focus:ring-2 focus:ring-primary"
            >
              {stores.map(s => (
                <option key={s.code} value={s.code}>
                  [{s.code}] {s.name || s.code} {s.region ? `(${s.region})` : ''}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1 w-32">
            <label className="text-xs font-semibold text-gray-700 dark:text-gray-300">
              費用年份 (Year)
            </label>
            <select
              value={year}
              onChange={e => setYear(Number(e.target.value))}
              className="w-full h-10 rounded-lg border bg-background px-3 text-sm font-medium"
            >
              {[now.getFullYear(), now.getFullYear() - 1].map(y => (
                <option key={y} value={y}>{y} 年</option>
              ))}
            </select>
          </div>

          <div className="space-y-1 w-28">
            <label className="text-xs font-semibold text-gray-700 dark:text-gray-300">
              費用月份 (Month)
            </label>
            <select
              value={month}
              onChange={e => setMonth(Number(e.target.value))}
              className="w-full h-10 rounded-lg border bg-background px-3 text-sm font-medium"
            >
              {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                <option key={m} value={m}>{m} 月</option>
              ))}
            </select>
          </div>

          <div className="self-end">
            <Button variant="ghost" size="sm" onClick={loadData} disabled={loading} className="h-10 px-3">
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </div>

        {currentStoreObj && (
          <div className="mt-3 pt-3 border-t flex flex-wrap gap-4 text-xs text-muted-foreground">
            <span>⚡ 電號：<b className="text-foreground">{currentStoreObj.electricity_no || '未設定'}</b></span>
            <span>💧 水號：<b className="text-foreground">{currentStoreObj.water_no || '未設定'}</b></span>
            <span>📍 區域：<b className="text-foreground">{currentStoreObj.region || '—'}</b></span>
          </div>
        )}
      </Card>

      {/* 訊息反饋 */}
      {msg && (
        <div
          className={`p-3.5 rounded-xl border flex items-center gap-2.5 text-sm font-medium ${
            msg.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300'
              : 'bg-rose-50 text-rose-800 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300'
          }`}
        >
          {msg.type === 'success' ? (
            <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
          ) : (
            <AlertCircle className="h-5 w-5 text-rose-600 shrink-0" />
          )}
          <span>{msg.text}</span>
          <button onClick={() => setMsg(null)} className="ml-auto text-xs opacity-70 hover:opacity-100">
            ✕
          </button>
        </div>
      )}

      {/* 填報主卡片 */}
      <div className="grid md:grid-cols-2 gap-5">
        {/* 1. 電費申報 */}
        <Card className="p-5 space-y-4 border-amber-200/70 dark:border-amber-900/40 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-amber-100 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400">
                <Zap className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-bold text-base">本期電費 (Electricity)</h3>
                <p className="text-xs text-muted-foreground">科目編碼: ELEC</p>
              </div>
            </div>
            {currentBills.some(b => b.store_code === selectedStore && b.category_code === 'ELEC') && (
              <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-200 gap-1 text-[11px]">
                <Check className="h-3 w-3" />已登記出納
              </Badge>
            )}
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-gray-700 dark:text-gray-300">
              電費金額 (VND) *
            </label>
            <div className="relative">
              <Input
                type="number"
                placeholder="例如: 3500000"
                value={elecAmount}
                onChange={e => setElecAmount(e.target.value)}
                className="font-mono text-base font-bold pr-8"
              />
              <span className="absolute right-3 top-2.5 text-xs text-gray-400">₫</span>
            </div>
            {elecAmount && Number(elecAmount) > 0 && (
              <p className="text-xs text-amber-700 dark:text-amber-300 font-medium">
                約 {fmt(Number(elecAmount))} VND
              </p>
            )}
          </div>

          {/* 單據憑證拍照/上傳 */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-gray-700 dark:text-gray-300 flex items-center justify-between">
              <span>電費發票／繳費收據照片 (憑證)</span>
              {elecReceiptUrl && (
                <a
                  href={elecReceiptUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs text-primary underline inline-flex items-center gap-1"
                >
                  查看單據 <ExternalLink className="h-3 w-3" />
                </a>
              )}
            </label>

            <input
              ref={elecFileRef}
              type="file"
              accept="image/*,.pdf"
              className="hidden"
              onChange={e => {
                const f = e.target.files?.[0]
                if (f) handleFileUpload(f, 'elec')
              }}
            />

            {elecReceiptUrl ? (
              <div className="relative rounded-lg border p-2 bg-muted/40 flex items-center gap-3">
                {elecReceiptUrl.match(/\.(jpg|jpeg|png|webp)/i) ? (
                  <img src={elecReceiptUrl} alt="電費單據" className="h-12 w-12 object-cover rounded border" />
                ) : (
                  <FileText className="h-10 w-10 text-amber-600" />
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 flex items-center gap-1">
                    <Check className="h-3.5 w-3.5" />單據已上傳成功
                  </p>
                  <p className="text-[11px] text-muted-foreground truncate">{elecReceiptUrl}</p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="text-xs h-7"
                  disabled={uploadingElec}
                  onClick={() => elecFileRef.current?.click()}
                >
                  更換
                </Button>
              </div>
            ) : (
              <div
                onClick={() => elecFileRef.current?.click()}
                className="border-2 border-dashed border-amber-200 dark:border-amber-800/60 rounded-xl p-4 text-center cursor-pointer hover:bg-amber-50/40 dark:hover:bg-amber-950/20 transition-colors"
              >
                {uploadingElec ? (
                  <div className="flex items-center justify-center gap-2 text-xs text-amber-600">
                    <Loader2 className="h-4 w-4 animate-spin" />上傳中...
                  </div>
                ) : (
                  <div className="space-y-1 text-xs text-muted-foreground">
                    <Upload className="h-5 w-5 mx-auto text-amber-600" />
                    <p className="font-medium text-foreground">點擊上傳或拍照電費單據</p>
                    <p className="text-[11px]">支援 JPG, PNG, PDF</p>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">備註（如用電度數或經辦人）</label>
            <Input
              placeholder="例：度數 1450 度，8月帳單"
              value={elecNote}
              onChange={e => setElecNote(e.target.value)}
              className="text-xs"
            />
          </div>
        </Card>

        {/* 2. 水費申報 */}
        <Card className="p-5 space-y-4 border-blue-200/70 dark:border-blue-900/40 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-blue-100 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400">
                <Droplets className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-bold text-base">本期水費 (Water)</h3>
                <p className="text-xs text-muted-foreground">科目編碼: WATER</p>
              </div>
            </div>
            {currentBills.some(b => b.store_code === selectedStore && b.category_code === 'WATER') && (
              <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-200 gap-1 text-[11px]">
                <Check className="h-3 w-3" />已登記出納
              </Badge>
            )}
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-gray-700 dark:text-gray-300">
              水費金額 (VND) *
            </label>
            <div className="relative">
              <Input
                type="number"
                placeholder="例如: 850000"
                value={waterAmount}
                onChange={e => setWaterAmount(e.target.value)}
                className="font-mono text-base font-bold pr-8"
              />
              <span className="absolute right-3 top-2.5 text-xs text-gray-400">₫</span>
            </div>
            {waterAmount && Number(waterAmount) > 0 && (
              <p className="text-xs text-blue-700 dark:text-blue-300 font-medium">
                約 {fmt(Number(waterAmount))} VND
              </p>
            )}
          </div>

          {/* 單據憑證拍照/上傳 */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-gray-700 dark:text-gray-300 flex items-center justify-between">
              <span>水費發票／繳費收據照片 (憑證)</span>
              {waterReceiptUrl && (
                <a
                  href={waterReceiptUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs text-primary underline inline-flex items-center gap-1"
                >
                  查看單據 <ExternalLink className="h-3 w-3" />
                </a>
              )}
            </label>

            <input
              ref={waterFileRef}
              type="file"
              accept="image/*,.pdf"
              className="hidden"
              onChange={e => {
                const f = e.target.files?.[0]
                if (f) handleFileUpload(f, 'water')
              }}
            />

            {waterReceiptUrl ? (
              <div className="relative rounded-lg border p-2 bg-muted/40 flex items-center gap-3">
                {waterReceiptUrl.match(/\.(jpg|jpeg|png|webp)/i) ? (
                  <img src={waterReceiptUrl} alt="水費單據" className="h-12 w-12 object-cover rounded border" />
                ) : (
                  <FileText className="h-10 w-10 text-blue-600" />
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 flex items-center gap-1">
                    <Check className="h-3.5 w-3.5" />單據已上傳成功
                  </p>
                  <p className="text-[11px] text-muted-foreground truncate">{waterReceiptUrl}</p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="text-xs h-7"
                  disabled={uploadingWater}
                  onClick={() => waterFileRef.current?.click()}
                >
                  更換
                </Button>
              </div>
            ) : (
              <div
                onClick={() => waterFileRef.current?.click()}
                className="border-2 border-dashed border-blue-200 dark:border-blue-800/60 rounded-xl p-4 text-center cursor-pointer hover:bg-blue-50/40 dark:hover:bg-blue-950/20 transition-colors"
              >
                {uploadingWater ? (
                  <div className="flex items-center justify-center gap-2 text-xs text-blue-600">
                    <Loader2 className="h-4 w-4 animate-spin" />上傳中...
                  </div>
                ) : (
                  <div className="space-y-1 text-xs text-muted-foreground">
                    <Upload className="h-5 w-5 mx-auto text-blue-600" />
                    <p className="font-medium text-foreground">點擊上傳或拍照水費單據</p>
                    <p className="text-[11px]">支援 JPG, PNG, PDF</p>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">備註（如用水度數或經辦人）</label>
            <Input
              placeholder="例：抄表 85 度"
              value={waterNote}
              onChange={e => setWaterNote(e.target.value)}
              className="text-xs"
            />
          </div>
        </Card>
      </div>

      {/* 3. 額外門市雜支（瓦斯桶等可選項目） */}
      <Card className="p-4 border bg-card/40 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Flame className="h-4 w-4 text-orange-500" />
            <h4 className="text-sm font-semibold">門市自叫瓦斯或其他雜支 (可選填)</h4>
          </div>
        </div>
        <div className="grid sm:grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">瓦斯金額 (GAS, VND)</label>
            <Input
              type="number"
              placeholder="例: 480000"
              value={gasAmount}
              onChange={e => setGasAmount(e.target.value)}
              className="text-xs"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">瓦斯備註 (叫桶數量 / 廠商)</label>
            <Input
              placeholder="例：大桶瓦斯 1 桶"
              value={gasNote}
              onChange={e => setGasNote(e.target.value)}
              className="text-xs"
            />
          </div>
        </div>
      </Card>

      {/* 提交按鈕列 */}
      <div className="flex items-center justify-between pt-2">
        <p className="text-xs text-muted-foreground">
          📌 送出後將自動建立費用紀錄至出納總務系統（<code>fin_bills</code>），出納月度費用與損益報表即時同步連動。
        </p>
        <Button
          size="lg"
          onClick={handleSubmit}
          disabled={submitting || (!elecAmount && !waterAmount && !gasAmount)}
          className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2 font-semibold px-6 shadow-md"
        >
          {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
          確認送出並串接至出納
        </Button>
      </div>

      {/* 本期已登記費用清單 */}
      <Card className="p-5 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-sm flex items-center gap-2">
            <Receipt className="h-4 w-4 text-primary" />
            [{selectedStore}] {year} 年 {month} 月 已提報費用一覽
          </h3>
          <span className="text-xs text-muted-foreground">
            出納總務端同步狀態
          </span>
        </div>

        {currentBills.filter(b => b.store_code === selectedStore).length === 0 ? (
          <div className="text-center py-6 text-xs text-muted-foreground">
            本門市於此月份尚未提報水電費用。請於上方輸入金額後點擊送出。
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b text-muted-foreground">
                  <th className="py-2 text-left">費用科目</th>
                  <th className="py-2 text-right">申報金額</th>
                  <th className="py-2 text-center">來源狀態</th>
                  <th className="py-2 text-left">單據／憑證</th>
                  <th className="py-2 text-right">更新時間</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {currentBills.filter(b => b.store_code === selectedStore).map((b, i) => {
                  let receiptUrl = ''
                  let parsedNote = b.note || ''
                  try {
                    const parsed = JSON.parse(b.note || '{}')
                    if (parsed.receipt_url) receiptUrl = parsed.receipt_url
                    if (parsed.note) parsedNote = parsed.note
                  } catch {
                    // plain text note
                  }

                  return (
                    <tr key={i} className="hover:bg-muted/30">
                      <td className="py-2.5 font-semibold">
                        {b.category_code === 'ELEC' && '⚡ 電費 (ELEC)'}
                        {b.category_code === 'WATER' && '💧 水費 (WATER)'}
                        {b.category_code === 'GAS' && '🔥 瓦斯費 (GAS)'}
                        {!['ELEC', 'WATER', 'GAS'].includes(b.category_code) && b.category_code}
                      </td>
                      <td className="py-2.5 text-right font-mono font-bold text-sm text-foreground">
                        {fmt(b.amount)} <span className="text-[11px] font-normal text-muted-foreground">VND</span>
                      </td>
                      <td className="py-2.5 text-center">
                        <Badge variant="outline" className="text-[10px] bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200">
                          {b.source === 'store_upload' ? '門市已送出' : b.source}
                        </Badge>
                      </td>
                      <td className="py-2.5">
                        {receiptUrl ? (
                          <a
                            href={receiptUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 text-primary hover:underline font-medium"
                          >
                            <ImageIcon className="h-3 w-3" />
                            檢視單據照片 <ExternalLink className="h-2.5 w-2.5" />
                          </a>
                        ) : (
                          <span className="text-muted-foreground">{parsedNote || '—'}</span>
                        )}
                      </td>
                      <td className="py-2.5 text-right text-muted-foreground">
                        {b.updated_at ? new Date(b.updated_at).toLocaleString('zh-TW', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  )
}
