'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import Link from 'next/link'
import { useTranslations, useLocale } from 'next-intl'
import {
  Zap, Droplets, Receipt, Upload, CheckCircle2, AlertCircle,
  Loader2, Image as ImageIcon, Store, Calendar, ArrowRight,
  RefreshCw, FileText, Check, ExternalLink, Flame, Snowflake, Wifi, Plus, Building2
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'

const fmt = (n: number, locale: string) => Math.round(Number(n) || 0).toLocaleString(locale === 'vi' ? 'vi-VN' : locale === 'en' ? 'en-US' : 'zh-TW')

interface StoreItem {
  code: string
  name: string
  region: string
  unit_type?: string
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
  const t = useTranslations('StoreBills')
  const locale = useLocale()
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [stores, setStores] = useState<StoreItem[]>([])
  const [selectedStore, setSelectedStore] = useState('')
  const [lockedStore, setLockedStore] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [uploadingElec, setUploadingElec] = useState(false)
  const [uploadingWater, setUploadingWater] = useState(false)
  const [uploadingGas, setUploadingGas] = useState(false)
  const [uploadingIce, setUploadingIce] = useState(false)
  const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  // 電費狀態
  const [elecAmount, setElecAmount] = useState<string>('')
  const [elecReceiptUrl, setElecReceiptUrl] = useState<string>('')
  const [elecNote, setElecNote] = useState<string>('')

  // 水費狀態
  const [waterAmount, setWaterAmount] = useState<string>('')
  const [waterReceiptUrl, setWaterReceiptUrl] = useState<string>('')
  const [waterNote, setWaterNote] = useState<string>('')

  // 瓦斯狀態（含單據照片與桶數）
  const [gasAmount, setGasAmount] = useState<string>('')
  const [gasReceiptUrl, setGasReceiptUrl] = useState<string>('')
  const [gasCylinders, setGasCylinders] = useState<string>('')
  const [gasNote, setGasNote] = useState<string>('')

  // 冰塊狀態（含單據照片與包數/規格）
  const [iceAmount, setIceAmount] = useState<string>('')
  const [iceReceiptUrl, setIceReceiptUrl] = useState<string>('')
  const [iceQuantity, setIceQuantity] = useState<string>('')
  const [iceNote, setIceNote] = useState<string>('')

  // 已送出之本期紀錄
  const [currentBills, setCurrentBills] = useState<BillRecord[]>([])

  const elecFileRef = useRef<HTMLInputElement>(null)
  const waterFileRef = useRef<HTMLInputElement>(null)
  const gasFileRef = useRef<HTMLInputElement>(null)
  const iceFileRef = useRef<HTMLInputElement>(null)

  // 載入門市與本期帳單
  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/fin/bills?year=${year}&month=${month}${selectedStore ? `&store_code=${encodeURIComponent(selectedStore)}` : ''}`)
      if (res.ok) {
        const d = await res.json()
        const stList: StoreItem[] = d.stores ?? []
        setStores(stList)
        if (d.locked_store) {
          setLockedStore(d.locked_store)
          setSelectedStore(d.locked_store)
        } else if (!selectedStore && stList.length > 0) {
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
            try {
              const parsed = JSON.parse(gBill.note || '{}')
              if (parsed.receipt_url) setGasReceiptUrl(parsed.receipt_url)
              if (parsed.cylinders) setGasCylinders(parsed.cylinders)
              if (parsed.note) setGasNote(parsed.note)
            } catch {
              setGasNote(gBill.note || '')
            }
          } else {
            setGasAmount('')
            setGasReceiptUrl('')
            setGasCylinders('')
            setGasNote('')
          }

          const iBill = bills.find(b => b.store_code === selectedStore && b.category_code === 'ICE')
          if (iBill) {
            setIceAmount(String(iBill.amount || ''))
            try {
              const parsed = JSON.parse(iBill.note || '{}')
              if (parsed.receipt_url) setIceReceiptUrl(parsed.receipt_url)
              if (parsed.quantity || parsed.cylinders) setIceQuantity(parsed.quantity || parsed.cylinders)
              if (parsed.note) setIceNote(parsed.note)
            } catch {
              setIceNote(iBill.note || '')
            }
          } else {
            setIceAmount('')
            setIceReceiptUrl('')
            setIceQuantity('')
            setIceNote('')
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
  const handleFileUpload = async (file: File, type: 'elec' | 'water' | 'gas' | 'ice') => {
    if (type === 'elec') setUploadingElec(true)
    else if (type === 'water') setUploadingWater(true)
    else if (type === 'gas') setUploadingGas(true)
    else setUploadingIce(true)

    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await fetch('/api/fin/bills/upload', {
        method: 'POST',
        body: fd,
      })
      const data = await res.json()
      if (res.ok && data.url) {
        if (type === 'elec') setElecReceiptUrl(data.url)
        else if (type === 'water') setWaterReceiptUrl(data.url)
        else if (type === 'gas') setGasReceiptUrl(data.url)
        else setIceReceiptUrl(data.url)

        const typeLabel = type === 'elec' ? t('elec') : type === 'water' ? t('water') : type === 'gas' ? t('gas') : t('ice')
        setMsg({ type: 'success', text: t('uploadSuccess', { type: typeLabel }) })
      } else {
        setMsg({ type: 'error', text: data.error || t('uploadFailed') })
      }
    } catch {
      setMsg({ type: 'error', text: t('uploadNetworkError') })
    } finally {
      if (type === 'elec') setUploadingElec(false)
      else if (type === 'water') setUploadingWater(false)
      else if (type === 'gas') setUploadingGas(false)
      else setUploadingIce(false)
    }
  }

  // 提交申報至出納
  const handleSubmit = async () => {
    if (!selectedStore) {
      setMsg({ type: 'error', text: t('selectStoreFirst') })
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

      // 3. 瓦斯
      if (gasAmount !== '' || gasReceiptUrl) {
        const notePayload = JSON.stringify({
          receipt_url: gasReceiptUrl || '',
          cylinders: gasCylinders || '',
          note: gasNote || '',
          submitted_at: new Date().toISOString(),
        })
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
              note: notePayload,
            }),
          })
        )
      }

      // 4. 冰塊
      if (iceAmount !== '' || iceReceiptUrl) {
        const notePayload = JSON.stringify({
          receipt_url: iceReceiptUrl || '',
          quantity: iceQuantity || '',
          cylinders: iceQuantity || '',
          note: iceNote || '',
          submitted_at: new Date().toISOString(),
        })
        tasks.push(
          fetch('/api/fin/bills', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              store_code: selectedStore,
              category_code: 'ICE',
              year,
              month,
              amount: Number(iceAmount) || 0,
              source: 'store_upload',
              note: notePayload,
            }),
          })
        )
      }

      const results = await Promise.all(tasks)
      const hasError = results.some(r => !r.ok)

      if (hasError) {
        setMsg({ type: 'error', text: t('submitPartialFailed') })
      } else {
        setMsg({ type: 'success', text: t('submitSuccess') })
        loadData()
      }
    } catch {
      setMsg({ type: 'error', text: t('submitFailed') })
    } finally {
      setSubmitting(false)
    }
  }

  const currentStoreObj = stores.find(s => s.code === selectedStore)

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      {/* 頂部標題 */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b pb-4">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center text-white shadow-md">
            <Receipt className="h-6 w-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight">{t('pageTitle')}</h1>
              <span className="text-[11px] px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 font-medium">
                {t('autoLinkBadge')}
              </span>
            </div>
            <p className="text-sm text-muted-foreground">
              {t('pageSubtitle')}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Link href="/store-inventory">
            <Button variant="outline" size="sm" className="gap-1.5 text-xs">
              <Store className="h-3.5 w-3.5" />{t('navInventory')}
            </Button>
          </Link>
          <Link href="/repair">
            <Button variant="outline" size="sm" className="gap-1.5 text-xs text-amber-700 dark:text-amber-400">
              <Plus className="h-3.5 w-3.5" />{t('navRepair')}
            </Button>
          </Link>
        </div>
      </div>

      {/* 門市與年月選取器 */}
      <Card className="p-4 bg-card/60 border shadow-sm">
        <div className="flex flex-wrap items-center gap-4">
          <div className="space-y-1 flex-1 min-w-[200px]">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                {t('storeSelectLabel')}
              </label>
              {lockedStore && (
                <Badge variant="outline" className="text-[11px] bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-300 font-normal">
                  {t('lockedStoreBadge')}
                </Badge>
              )}
            </div>
            <select
              value={selectedStore}
              disabled={!!lockedStore}
              onChange={e => setSelectedStore(e.target.value)}
              className="w-full h-10 rounded-lg border bg-background px-3 text-sm font-medium focus:ring-2 focus:ring-primary disabled:opacity-90 disabled:cursor-not-allowed disabled:bg-muted/50"
            >
              {stores.map(s => (
                <option key={s.code} value={s.code}>
                  [{s.code}] {s.name || s.code} {s.region ? `(${s.region})` : ''} {s.unit_type && s.unit_type !== 'store' ? `[${s.unit_type}]` : ''}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1 w-32">
            <label className="text-xs font-semibold text-gray-700 dark:text-gray-300">
              {t('yearLabel')}
            </label>
            <select
              value={year}
              onChange={e => setYear(Number(e.target.value))}
              className="w-full h-10 rounded-lg border bg-background px-3 text-sm font-medium"
            >
              {[now.getFullYear(), now.getFullYear() - 1].map(y => (
                <option key={y} value={y}>{t('yearOption', { y })}</option>
              ))}
            </select>
          </div>

          <div className="space-y-1 w-28">
            <label className="text-xs font-semibold text-gray-700 dark:text-gray-300">
              {t('monthLabel')}
            </label>
            <select
              value={month}
              onChange={e => setMonth(Number(e.target.value))}
              className="w-full h-10 rounded-lg border bg-background px-3 text-sm font-medium"
            >
              {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                <option key={m} value={m}>{t('monthOption', { m })}</option>
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
            <span>{t('electricityNoLabel')}<b className="text-foreground">{currentStoreObj.electricity_no || t('notSet')}</b></span>
            <span>{t('waterNoLabel')}<b className="text-foreground">{currentStoreObj.water_no || t('notSet')}</b></span>
            <span>{t('regionLabel')}<b className="text-foreground">{currentStoreObj.region || '—'}</b></span>
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

      {/* 填報主卡片（電費、水費、瓦斯費、冰塊費 四大核心公用支出） */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* 1. 電費申報 */}
        <Card className="p-4 space-y-3.5 border-amber-200/70 dark:border-amber-900/40 shadow-sm relative overflow-hidden flex flex-col justify-between">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-amber-100 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400">
                  <Zap className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="font-bold text-sm">{t('elecCardTitle')}</h3>
                  <p className="text-[11px] text-muted-foreground">{t('elecSubject')}</p>
                </div>
              </div>
              {currentBills.some(b => b.store_code === selectedStore && b.category_code === 'ELEC') && (
                <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-200 gap-0.5 text-[10px] px-1.5 py-0.5">
                  <Check className="h-3 w-3" />{t('registered')}
                </Badge>
              )}
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                {t('elecAmountLabel')}
              </label>
              <div className="relative">
                <Input
                  type="number"
                  placeholder="3500000"
                  value={elecAmount}
                  onChange={e => setElecAmount(e.target.value)}
                  className="font-mono text-sm font-bold pr-8"
                />
                <span className="absolute right-3 top-2 text-xs text-gray-400">₫</span>
              </div>
              {elecAmount && Number(elecAmount) > 0 && (
                <p className="text-[11px] text-amber-700 dark:text-amber-300 font-medium">
                  {t('approxVnd', { n: fmt(Number(elecAmount), locale) })}
                </p>
              )}
            </div>

            {/* 單據憑證拍照/上傳 */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-gray-700 dark:text-gray-300 flex items-center justify-between">
                <span>{t('elecReceiptLabel')}</span>
                {elecReceiptUrl && (
                  <a
                    href={elecReceiptUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs text-primary underline inline-flex items-center gap-1"
                  >
                    {t('viewReceipt')} <ExternalLink className="h-2.5 w-2.5" />
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
                <div className="relative rounded-lg border p-2 bg-muted/40 flex items-center gap-2">
                  {elecReceiptUrl.match(/\.(jpg|jpeg|png|webp)/i) ? (
                    <img src={elecReceiptUrl} alt={t('elecReceiptAlt')} className="h-10 w-10 object-cover rounded border shrink-0" />
                  ) : (
                    <FileText className="h-8 w-8 text-amber-600 shrink-0" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-400 flex items-center gap-1">
                      <Check className="h-3 w-3" />{t('receiptUploaded')}
                    </p>
                    <p className="text-[10px] text-muted-foreground truncate">{elecReceiptUrl}</p>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-[11px] h-6 px-2"
                    disabled={uploadingElec}
                    onClick={() => elecFileRef.current?.click()}
                  >
                    {t('replace')}
                  </Button>
                </div>
              ) : (
                <div
                  onClick={() => elecFileRef.current?.click()}
                  className="border-2 border-dashed border-amber-200 dark:border-amber-800/60 rounded-xl p-3 text-center cursor-pointer hover:bg-amber-50/40 dark:hover:bg-amber-950/20 transition-colors"
                >
                  {uploadingElec ? (
                    <div className="flex items-center justify-center gap-1.5 text-xs text-amber-600">
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />{t('uploading')}
                    </div>
                  ) : (
                    <div className="space-y-0.5 text-xs text-muted-foreground">
                      <Upload className="h-4 w-4 mx-auto text-amber-600" />
                      <p className="font-medium text-foreground text-[11px]">{t('uploadElecReceipt')}</p>
                      <p className="text-[10px]">JPG, PNG, PDF</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="space-y-1 pt-2">
            <label className="text-[11px] text-muted-foreground">{t('elecNoteLabel')}</label>
            <Input
              placeholder={t('elecNotePlaceholder')}
              value={elecNote}
              onChange={e => setElecNote(e.target.value)}
              className="text-xs h-8"
            />
          </div>
        </Card>

        {/* 2. 水費申報 */}
        <Card className="p-4 space-y-3.5 border-blue-200/70 dark:border-blue-900/40 shadow-sm relative overflow-hidden flex flex-col justify-between">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-blue-100 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400">
                  <Droplets className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="font-bold text-sm">{t('waterCardTitle')}</h3>
                  <p className="text-[11px] text-muted-foreground">{t('waterSubject')}</p>
                </div>
              </div>
              {currentBills.some(b => b.store_code === selectedStore && b.category_code === 'WATER') && (
                <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-200 gap-0.5 text-[10px] px-1.5 py-0.5">
                  <Check className="h-3 w-3" />{t('registered')}
                </Badge>
              )}
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                {t('waterAmountLabel')}
              </label>
              <div className="relative">
                <Input
                  type="number"
                  placeholder="850000"
                  value={waterAmount}
                  onChange={e => setWaterAmount(e.target.value)}
                  className="font-mono text-sm font-bold pr-8"
                />
                <span className="absolute right-3 top-2 text-xs text-gray-400">₫</span>
              </div>
              {waterAmount && Number(waterAmount) > 0 && (
                <p className="text-[11px] text-blue-700 dark:text-blue-300 font-medium">
                  {t('approxVnd', { n: fmt(Number(waterAmount), locale) })}
                </p>
              )}
            </div>

            {/* 單據憑證拍照/上傳 */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-gray-700 dark:text-gray-300 flex items-center justify-between">
                <span>{t('waterReceiptLabel')}</span>
                {waterReceiptUrl && (
                  <a
                    href={waterReceiptUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs text-primary underline inline-flex items-center gap-1"
                  >
                    {t('viewReceipt')} <ExternalLink className="h-2.5 w-2.5" />
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
                <div className="relative rounded-lg border p-2 bg-muted/40 flex items-center gap-2">
                  {waterReceiptUrl.match(/\.(jpg|jpeg|png|webp)/i) ? (
                    <img src={waterReceiptUrl} alt={t('waterReceiptAlt')} className="h-10 w-10 object-cover rounded border shrink-0" />
                  ) : (
                    <FileText className="h-8 w-8 text-blue-600 shrink-0" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-400 flex items-center gap-1">
                      <Check className="h-3 w-3" />{t('receiptUploaded')}
                    </p>
                    <p className="text-[10px] text-muted-foreground truncate">{waterReceiptUrl}</p>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-[11px] h-6 px-2"
                    disabled={uploadingWater}
                    onClick={() => waterFileRef.current?.click()}
                  >
                    {t('replace')}
                  </Button>
                </div>
              ) : (
                <div
                  onClick={() => waterFileRef.current?.click()}
                  className="border-2 border-dashed border-blue-200 dark:border-blue-800/60 rounded-xl p-3 text-center cursor-pointer hover:bg-blue-50/40 dark:hover:bg-blue-950/20 transition-colors"
                >
                  {uploadingWater ? (
                    <div className="flex items-center justify-center gap-1.5 text-xs text-blue-600">
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />{t('uploading')}
                    </div>
                  ) : (
                    <div className="space-y-0.5 text-xs text-muted-foreground">
                      <Upload className="h-4 w-4 mx-auto text-blue-600" />
                      <p className="font-medium text-foreground text-[11px]">{t('uploadWaterReceipt')}</p>
                      <p className="text-[10px]">JPG, PNG, PDF</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="space-y-1 pt-2">
            <label className="text-[11px] text-muted-foreground">{t('waterNoteLabel')}</label>
            <Input
              placeholder={t('waterNotePlaceholder')}
              value={waterNote}
              onChange={e => setWaterNote(e.target.value)}
              className="text-xs h-8"
            />
          </div>
        </Card>

        {/* 3. 瓦斯費申報 (完整支援單據照片上傳與叫桶數量) */}
        <Card className="p-4 space-y-3.5 border-orange-200/70 dark:border-orange-900/40 shadow-sm relative overflow-hidden flex flex-col justify-between">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-orange-100 dark:bg-orange-950/60 text-orange-600 dark:text-orange-400">
                  <Flame className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="font-bold text-sm">{t('gasCardTitle')}</h3>
                  <p className="text-[11px] text-muted-foreground">{t('gasSubject')}</p>
                </div>
              </div>
              {currentBills.some(b => b.store_code === selectedStore && b.category_code === 'GAS') && (
                <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-200 gap-0.5 text-[10px] px-1.5 py-0.5">
                  <Check className="h-3 w-3" />{t('registered')}
                </Badge>
              )}
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                {t('gasAmountLabel')}
              </label>
              <div className="relative">
                <Input
                  type="number"
                  placeholder="960000"
                  value={gasAmount}
                  onChange={e => setGasAmount(e.target.value)}
                  className="font-mono text-sm font-bold pr-8"
                />
                <span className="absolute right-3 top-2 text-xs text-gray-400">₫</span>
              </div>
              {gasAmount && Number(gasAmount) > 0 && (
                <p className="text-[11px] text-orange-700 dark:text-orange-300 font-medium">
                  {t('approxVnd', { n: fmt(Number(gasAmount), locale) })}
                </p>
              )}
            </div>

            {/* 瓦斯簽收單/發票憑證拍照上傳 */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-gray-700 dark:text-gray-300 flex items-center justify-between">
                <span>{t('gasReceiptLabel')}</span>
                {gasReceiptUrl && (
                  <a
                    href={gasReceiptUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs text-primary underline inline-flex items-center gap-1"
                  >
                    {t('viewReceipt')} <ExternalLink className="h-2.5 w-2.5" />
                  </a>
                )}
              </label>

              <input
                ref={gasFileRef}
                type="file"
                accept="image/*,.pdf"
                className="hidden"
                onChange={e => {
                  const f = e.target.files?.[0]
                  if (f) handleFileUpload(f, 'gas')
                }}
              />

              {gasReceiptUrl ? (
                <div className="relative rounded-lg border p-2 bg-muted/40 flex items-center gap-2">
                  {gasReceiptUrl.match(/\.(jpg|jpeg|png|webp)/i) ? (
                    <img src={gasReceiptUrl} alt={t('gasReceiptAlt')} className="h-10 w-10 object-cover rounded border shrink-0" />
                  ) : (
                    <FileText className="h-8 w-8 text-orange-600 shrink-0" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-400 flex items-center gap-1">
                      <Check className="h-3 w-3" />{t('receiptUploaded')}
                    </p>
                    <p className="text-[10px] text-muted-foreground truncate">{gasReceiptUrl}</p>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-[11px] h-6 px-2"
                    disabled={uploadingGas}
                    onClick={() => gasFileRef.current?.click()}
                  >
                    {t('replace')}
                  </Button>
                </div>
              ) : (
                <div
                  onClick={() => gasFileRef.current?.click()}
                  className="border-2 border-dashed border-orange-200 dark:border-orange-800/60 rounded-xl p-3 text-center cursor-pointer hover:bg-orange-50/40 dark:hover:bg-orange-950/20 transition-colors"
                >
                  {uploadingGas ? (
                    <div className="flex items-center justify-center gap-1.5 text-xs text-orange-600">
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />{t('uploading')}
                    </div>
                  ) : (
                    <div className="space-y-0.5 text-xs text-muted-foreground">
                      <Upload className="h-4 w-4 mx-auto text-orange-600" />
                      <p className="font-medium text-foreground text-[11px]">{t('uploadGasReceipt')}</p>
                      <p className="text-[10px]">JPG, PNG, PDF</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 pt-2">
            <div className="space-y-1">
              <label className="text-[11px] text-muted-foreground">{t('gasCylindersLabel')}</label>
              <Input
                placeholder={t('gasCylindersPlaceholder')}
                value={gasCylinders}
                onChange={e => setGasCylinders(e.target.value)}
                className="text-xs h-8"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[11px] text-muted-foreground">{t('gasVendorNoteLabel')}</label>
              <Input
                placeholder={t('gasVendorNotePlaceholder')}
                value={gasNote}
                onChange={e => setGasNote(e.target.value)}
                className="text-xs h-8"
              />
            </div>
          </div>
        </Card>

        {/* 4. 冰塊費申報 (完整支援送冰簽收單照片上傳與包數/規格) */}
        <Card className="p-4 space-y-3.5 border-cyan-200/70 dark:border-cyan-900/40 shadow-sm relative overflow-hidden flex flex-col justify-between">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-cyan-100 dark:bg-cyan-950/60 text-cyan-600 dark:text-cyan-400">
                  <Snowflake className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="font-bold text-sm">{t('iceCardTitle')}</h3>
                  <p className="text-[11px] text-muted-foreground">{t('iceSubject')}</p>
                </div>
              </div>
              {currentBills.some(b => b.store_code === selectedStore && b.category_code === 'ICE') && (
                <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-200 gap-0.5 text-[10px] px-1.5 py-0.5">
                  <Check className="h-3 w-3" />{t('registered')}
                </Badge>
              )}
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                {t('iceAmountLabel')}
              </label>
              <div className="relative">
                <Input
                  type="number"
                  placeholder="1200000"
                  value={iceAmount}
                  onChange={e => setIceAmount(e.target.value)}
                  className="font-mono text-sm font-bold pr-8"
                />
                <span className="absolute right-3 top-2 text-xs text-gray-400">₫</span>
              </div>
              {iceAmount && Number(iceAmount) > 0 && (
                <p className="text-[11px] text-cyan-700 dark:text-cyan-300 font-medium">
                  {t('approxVnd', { n: fmt(Number(iceAmount), locale) })}
                </p>
              )}
            </div>

            {/* 冰塊送貨單/簽收單拍照上傳 */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-gray-700 dark:text-gray-300 flex items-center justify-between">
                <span>{t('iceReceiptLabel')}</span>
                {iceReceiptUrl && (
                  <a
                    href={iceReceiptUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs text-primary underline inline-flex items-center gap-1"
                  >
                    {t('viewReceipt')} <ExternalLink className="h-2.5 w-2.5" />
                  </a>
                )}
              </label>

              <input
                ref={iceFileRef}
                type="file"
                accept="image/*,.pdf"
                className="hidden"
                onChange={e => {
                  const f = e.target.files?.[0]
                  if (f) handleFileUpload(f, 'ice')
                }}
              />

              {iceReceiptUrl ? (
                <div className="relative rounded-lg border p-2 bg-muted/40 flex items-center gap-2">
                  {iceReceiptUrl.match(/\.(jpg|jpeg|png|webp)/i) ? (
                    <img src={iceReceiptUrl} alt={t('iceReceiptAlt')} className="h-10 w-10 object-cover rounded border shrink-0" />
                  ) : (
                    <FileText className="h-8 w-8 text-cyan-600 shrink-0" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-400 flex items-center gap-1">
                      <Check className="h-3 w-3" />{t('receiptUploaded')}
                    </p>
                    <p className="text-[10px] text-muted-foreground truncate">{iceReceiptUrl}</p>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-[11px] h-6 px-2"
                    disabled={uploadingIce}
                    onClick={() => iceFileRef.current?.click()}
                  >
                    {t('replace')}
                  </Button>
                </div>
              ) : (
                <div
                  onClick={() => iceFileRef.current?.click()}
                  className="border-2 border-dashed border-cyan-200 dark:border-cyan-800/60 rounded-xl p-3 text-center cursor-pointer hover:bg-cyan-50/40 dark:hover:bg-cyan-950/20 transition-colors"
                >
                  {uploadingIce ? (
                    <div className="flex items-center justify-center gap-1.5 text-xs text-cyan-600">
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />{t('uploading')}
                    </div>
                  ) : (
                    <div className="space-y-0.5 text-xs text-muted-foreground">
                      <Upload className="h-4 w-4 mx-auto text-cyan-600" />
                      <p className="font-medium text-foreground text-[11px]">{t('uploadIceReceipt')}</p>
                      <p className="text-[10px]">JPG, PNG, PDF</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 pt-2">
            <div className="space-y-1">
              <label className="text-[11px] text-muted-foreground">{t('iceQuantityLabel')}</label>
              <Input
                placeholder={t('iceQuantityPlaceholder')}
                value={iceQuantity}
                onChange={e => setIceQuantity(e.target.value)}
                className="text-xs h-8"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[11px] text-muted-foreground">{t('iceVendorNoteLabel')}</label>
              <Input
                placeholder={t('iceVendorNotePlaceholder')}
                value={iceNote}
                onChange={e => setIceNote(e.target.value)}
                className="text-xs h-8"
              />
            </div>
          </div>
        </Card>
      </div>

      {/* 提交按鈕列 */}
      <div className="flex flex-wrap items-center justify-between gap-4 pt-2">
        <p className="text-xs text-muted-foreground">
          {t.rich('submitHint', { code: (chunks) => <code>{chunks}</code> })}
        </p>
        <Button
          size="lg"
          onClick={handleSubmit}
          disabled={submitting || (!elecAmount && !waterAmount && !gasAmount && !iceAmount && !elecReceiptUrl && !waterReceiptUrl && !gasReceiptUrl && !iceReceiptUrl)}
          className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2 font-semibold px-6 shadow-md"
        >
          {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
          {t('submitButton')}
        </Button>
      </div>

      {/* 本期已登記費用清單 */}
      <Card className="p-5 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-sm flex items-center gap-2">
            <Receipt className="h-4 w-4 text-primary" />
            {t('billListTitle', { store: selectedStore, year, month })}
          </h3>
          <span className="text-xs text-muted-foreground">
            {t('syncStatus')}
          </span>
        </div>

        {currentBills.filter(b => b.store_code === selectedStore).length === 0 ? (
          <div className="text-center py-6 text-xs text-muted-foreground">
            {t('billListEmpty')}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b text-muted-foreground">
                  <th className="py-2 text-left">{t('colSubject')}</th>
                  <th className="py-2 text-right">{t('colAmount')}</th>
                  <th className="py-2 text-center">{t('colSource')}</th>
                  <th className="py-2 text-left">{t('colReceipt')}</th>
                  <th className="py-2 text-left">{t('colNoteDetail')}</th>
                  <th className="py-2 text-right">{t('colUpdatedAt')}</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {currentBills.filter(b => b.store_code === selectedStore).map((b, i) => {
                  let receiptUrl = ''
                  let parsedNote = b.note || ''
                  let parsedCylinders = ''
                  try {
                    const parsed = JSON.parse(b.note || '{}')
                    if (parsed.receipt_url) receiptUrl = parsed.receipt_url
                    if (parsed.cylinders || parsed.quantity) parsedCylinders = parsed.cylinders || parsed.quantity
                    if (parsed.note) parsedNote = parsed.note
                  } catch {
                    // plain text note
                  }

                  return (
                    <tr key={i} className="hover:bg-muted/30">
                      <td className="py-2.5 font-semibold">
                        {b.category_code === 'ELEC' && t('categoryElec')}
                        {b.category_code === 'WATER' && t('categoryWater')}
                        {b.category_code === 'GAS' && t('categoryGas')}
                        {b.category_code === 'ICE' && t('categoryIce')}
                        {!['ELEC', 'WATER', 'GAS', 'ICE'].includes(b.category_code) && b.category_code}
                      </td>
                      <td className="py-2.5 text-right font-mono font-bold text-sm text-foreground">
                        {fmt(b.amount, locale)} <span className="text-[11px] font-normal text-muted-foreground">VND</span>
                      </td>
                      <td className="py-2.5 text-center">
                        <Badge
                          variant="outline"
                          className={`text-[10px] ${
                            b.source === 'store_upload'
                              ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200'
                              : b.source === 'vendor'
                              ? 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 border-indigo-200'
                              : 'bg-slate-50 text-slate-700'
                          }`}
                        >
                          {b.source === 'store_upload' ? t('sourceStoreUpload') : b.source === 'vendor' ? t('sourceVendor') : b.source}
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
                            {t('viewReceiptPhoto')} <ExternalLink className="h-2.5 w-2.5" />
                          </a>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="py-2.5 text-muted-foreground">
                        {parsedCylinders ? `[${parsedCylinders}] ` : ''}{parsedNote || '—'}
                      </td>
                      <td className="py-2.5 text-right text-muted-foreground">
                        {b.updated_at ? new Date(b.updated_at).toLocaleString(locale === 'vi' ? 'vi-VN' : locale === 'en' ? 'en-US' : 'zh-TW', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—'}
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
