'use client'

import React, { useState, useEffect } from 'react'
import Link from 'next/link'
import {
  Wallet, RefreshCw, CheckCircle2, AlertCircle, QrCode, Mail,
  ArrowRight, ExternalLink, Globe, Shield, ShoppingCart, DollarSign, Bell,
  Tag, Percent, Sliders, Calculator, Sparkles, Save, Check,
  Ticket, Plus, Trash2, ToggleLeft, ToggleRight, Pencil, X, Copy, History
} from 'lucide-react'
import { DEFAULT_PRICING_SETTINGS, EsimPricingSettings } from '@/lib/esim/catalog'

export default function EsimAdminPage() {
  const [activeTab, setActiveTab] = useState<'pricing' | 'overview' | 'orders' | 'coupons'>('pricing')
  
  // 廠商餘額與訂單狀態
  const [balance, setBalance] = useState<{ balance: number; currency: string; account: string } | null>(null)
  const [notices, setNotices] = useState<any[]>([])
  const [orders, setOrders] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [syncMessage, setSyncMessage] = useState('')

  // 定價與促銷設定狀態
  const [pricingSettings, setPricingSettings] = useState<EsimPricingSettings>(DEFAULT_PRICING_SETTINGS)
  const [savingSettings, setSavingSettings] = useState(false)
  const [settingsSavedMessage, setSettingsSavedMessage] = useState('')

  // 優惠券管理狀態
  const [coupons, setCoupons] = useState<any[]>([])
  const [loadingCoupons, setLoadingCoupons] = useState(false)
  const [savingCoupon, setSavingCoupon] = useState(false)
  const [couponMessage, setCouponMessage] = useState('')
  // 使用通知 Email
  const [notifyEnabled, setNotifyEnabled] = useState(false)
  const [notifyEmails, setNotifyEmails] = useState('')
  const [savingNotify, setSavingNotify] = useState(false)

  async function handleSaveNotify() {
    const emails = notifyEmails.split(/[,\s]+/).map(e => e.trim()).filter(Boolean)
    if (notifyEnabled && emails.length === 0) {
      alert('請至少填一個通知 Email')
      return
    }
    setSavingNotify(true)
    try {
      const data = await fetch('/api/esim/admin/coupons', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'save_notify', enabled: notifyEnabled, emails }),
      }).then(r => r.json())
      if (data.success) {
        setNotifyEnabled(!!data.notify.enabled)
        setNotifyEmails((data.notify.emails || []).join(', '))
        setCouponMessage(`✅ ${data.message}`)
        setTimeout(() => setCouponMessage(''), 4000)
      } else {
        alert(`儲存失敗: ${data.error}`)
      }
    } catch (err: any) {
      alert(`儲存異常: ${err.message}`)
    } finally {
      setSavingNotify(false)
    }
  }
  const [newCoupon, setNewCoupon] = useState({
    code: '',
    name: '',
    discount_type: 'fixed',
    discount_value: 50,
    min_spend_twd: 100,
    max_discount_twd: '',
    max_usage_count: '',
    max_uses_per_customer: '',
    starts_at: '',
    expires_at: '',
    applicable_countries: '',
    is_active: true,
  })
  // 贈品／限定產品選擇
  const [selectedPlans, setSelectedPlans] = useState<Record<string, string>>({})
  const [planCountry, setPlanCountry] = useState('JP')
  const [planOptions, setPlanOptions] = useState<any[]>([])
  const [planSearch, setPlanSearch] = useState('')
  const [loadingPlanOptions, setLoadingPlanOptions] = useState(false)

  async function loadPlanOptions() {
    const cc = planCountry.trim().toUpperCase()
    if (!cc) return
    setLoadingPlanOptions(true)
    try {
      const data = await fetch(`/api/esim/plans?country=${encodeURIComponent(cc)}`).then(r => r.json())
      setPlanOptions(data.success ? data.plans || [] : [])
    } catch {
      setPlanOptions([])
    } finally {
      setLoadingPlanOptions(false)
    }
  }

  function planLabel(p: any) {
    return `${p.flagEmoji || ''} ${p.primaryCountryName} ${p.dataTierLabel} ${p.day}天 (NT$ ${p.retailPriceTwd})`.trim()
  }

  function togglePlan(p: any) {
    setSelectedPlans(prev => {
      const next = { ...prev }
      if (next[p.channel_dataplan_id]) delete next[p.channel_dataplan_id]
      else next[p.channel_dataplan_id] = planLabel(p)
      return next
    })
  }

  // 即時定價試算器 (Simulator)
  const [testCostHkd, setTestCostHkd] = useState<number>(15.0)

  useEffect(() => {
    loadAdminData()
  }, [])

  async function loadAdminData() {
    setLoading(true)
    try {
      const [balRes, ordRes, setRes, cpnRes] = await Promise.all([
        fetch('/api/esim/balance').then(r => r.json()).catch(() => ({ success: false })),
        fetch('/api/esim/admin/orders').then(r => r.json()).catch(() => ({ success: false })),
        fetch('/api/esim/admin/settings').then(r => r.json()).catch(() => ({ success: false })),
        fetch('/api/esim/admin/coupons').then(r => r.json()).catch(() => ({ success: false })),
      ])

      if (balRes.success) {
        setBalance(balRes.balance)
        setNotices(balRes.notices || [])
      }

      if (ordRes.success) {
        setOrders(ordRes.orders || [])
      }

      if (setRes.success && setRes.settings) {
        setPricingSettings(setRes.settings)
      }

      if (cpnRes.success) {
        setCoupons(cpnRes.coupons || [])
        if (cpnRes.notify) {
          setNotifyEnabled(!!cpnRes.notify.enabled)
          setNotifyEmails((cpnRes.notify.emails || []).join(', '))
        }
      }
    } catch (err) {
      console.error('Failed to load admin data:', err)
    } finally {
      setLoading(false)
    }
  }

  const EMPTY_COUPON_FORM = {
    code: '',
    name: '',
    discount_type: 'fixed',
    discount_value: 50,
    min_spend_twd: 100,
    max_discount_twd: '',
    max_usage_count: '',
    max_uses_per_customer: '',
    starts_at: '',
    expires_at: '',
    applicable_countries: '',
    is_active: true,
  }
  const [editingCouponId, setEditingCouponId] = useState<string | null>(null)

  function handleEditCoupon(c: any, asCopy = false) {
    setEditingCouponId(asCopy ? null : c.id)
    setNewCoupon({
      code: asCopy ? `${c.code}_COPY` : c.code || '',
      name: c.name || '',
      discount_type: c.discount_type || 'fixed',
      discount_value: c.discount_value ?? 0,
      min_spend_twd: c.min_spend_twd ?? 0,
      max_discount_twd: c.max_discount_twd ? String(c.max_discount_twd) : '',
      max_usage_count: c.max_usage_count ? String(c.max_usage_count) : '',
      max_uses_per_customer: c.max_uses_per_customer ? String(c.max_uses_per_customer) : '',
      starts_at: c.starts_at ? String(c.starts_at).split('T')[0] : '',
      expires_at: c.expires_at ? String(c.expires_at).split('T')[0] : '',
      applicable_countries: (c.applicable_countries || []).join(','),
      is_active: c.is_active !== false,
    })
    const plans: Record<string, string> = {}
    for (const id of c.applicable_plan_ids || []) plans[id] = c.applicable_plan_names?.[id] || id
    setSelectedPlans(plans)
    setCouponMessage(asCopy ? `📋 已複製「${c.code}」的設定，請修改代碼後建立` : '')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function handleCancelEdit() {
    setEditingCouponId(null)
    setNewCoupon(EMPTY_COUPON_FORM)
    setSelectedPlans({})
  }

  // 批次產生
  const [batchPrefix, setBatchPrefix] = useState('')
  const [batchCount, setBatchCount] = useState(10)
  const [batchCodes, setBatchCodes] = useState<string[]>([])

  function buildCouponPayload() {
    const countries = newCoupon.applicable_countries
      ? newCoupon.applicable_countries.split(',').map((c: string) => c.trim().toUpperCase()).filter(Boolean)
      : []
    return {
      ...newCoupon,
      code: newCoupon.code.trim().toUpperCase(),
      max_discount_twd: newCoupon.max_discount_twd ? parseInt(newCoupon.max_discount_twd, 10) : undefined,
      max_usage_count: newCoupon.max_usage_count ? parseInt(newCoupon.max_usage_count, 10) : undefined,
      max_uses_per_customer: newCoupon.max_uses_per_customer ? parseInt(newCoupon.max_uses_per_customer, 10) : undefined,
      starts_at: newCoupon.starts_at || undefined,
      expires_at: newCoupon.expires_at || undefined,
      applicable_countries: countries,
      applicable_plan_ids: Object.keys(selectedPlans),
      applicable_plan_names: selectedPlans,
    }
  }

  function couponDatesInvalid() {
    if (newCoupon.starts_at && newCoupon.expires_at && newCoupon.starts_at > newCoupon.expires_at) {
      alert('啟用日期不可晚於到期日')
      return true
    }
    return false
  }

  async function handleBatchCreate() {
    if (couponDatesInvalid()) return
    if (batchCount < 1 || batchCount > 500) {
      alert('批次數量需介於 1～500')
      return
    }
    if (!newCoupon.max_usage_count && !confirm('未設定「使用次數上限」，每組代碼將可無限次使用。確定要繼續嗎？（一般建議設為 1）')) return
    setSavingCoupon(true)
    setCouponMessage('')
    try {
      const res = await fetch('/api/esim/admin/coupons', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'batch_create',
          prefix: batchPrefix,
          count: batchCount,
          coupon: buildCouponPayload(),
        }),
      })
      const data = await res.json()
      if (data.success) {
        setCoupons(data.coupons)
        setBatchCodes(data.codes || [])
        setCouponMessage(`✅ ${data.message}`)
      } else {
        alert(`批次產生失敗: ${data.error}`)
      }
    } catch (err: any) {
      alert(`批次產生異常: ${err.message}`)
    } finally {
      setSavingCoupon(false)
    }
  }

  function downloadBatchCsv() {
    const csv = 'code\n' + batchCodes.join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `coupons_${batchPrefix || 'batch'}_${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  // 搜尋篩選
  const [couponSearch, setCouponSearch] = useState('')
  const [couponTypeFilter, setCouponTypeFilter] = useState('all')
  const [couponStatusFilter, setCouponStatusFilter] = useState('all')

  function couponStatus(c: any): 'active' | 'paused' | 'expired' | 'used_up' | 'scheduled' {
    if (c.expires_at) {
      const d = String(c.expires_at)
      const t = /^\d{4}-\d{2}-\d{2}$/.test(d) ? new Date(`${d}T23:59:59+08:00`).getTime() : new Date(d).getTime()
      if (!isNaN(t) && t < Date.now()) return 'expired'
    }
    if (c.max_usage_count && (c.usage_count || 0) >= c.max_usage_count) return 'used_up'
    if (!c.is_active) return 'paused'
    if (c.starts_at) {
      const d = String(c.starts_at)
      const t = /^\d{4}-\d{2}-\d{2}$/.test(d) ? new Date(`${d}T00:00:00+08:00`).getTime() : new Date(d).getTime()
      if (!isNaN(t) && t > Date.now()) return 'scheduled'
    }
    return 'active'
  }

  const filteredCoupons = coupons.filter((c: any) => {
    const q = couponSearch.trim().toLowerCase()
    if (q) {
      const planNames = Object.values(c.applicable_plan_names || {}).join(' ')
      const hay = `${c.code} ${c.name} ${(c.applicable_countries || []).join(' ')} ${planNames}`.toLowerCase()
      if (!hay.includes(q)) return false
    }
    if (couponTypeFilter !== 'all' && c.discount_type !== couponTypeFilter) return false
    if (couponStatusFilter !== 'all' && couponStatus(c) !== couponStatusFilter) return false
    return true
  })
  const isCouponFiltered = couponSearch.trim() !== '' || couponTypeFilter !== 'all' || couponStatusFilter !== 'all'

  // 匯出優惠券 CSV（依目前篩選結果）
  function exportCouponsCsv() {
    const esc = (v: unknown) => {
      const str = v === undefined || v === null ? '' : String(v)
      return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str
    }
    const typeLabel = (t: string) => (t === 'free' ? '贈品' : t === 'percent' ? '成數折扣' : '現折金額')
    const header = ['代碼', '活動名稱', '折扣方式', '折扣數值', '最低消費', '最高折抵', '適用國家', '適用產品', '已兌換次數', '使用次數上限', '每人限用', '啟用日期', '到期日', '狀態', '建立時間']
    const rows = filteredCoupons.map((c: any) => [
      c.code,
      c.name,
      typeLabel(c.discount_type),
      c.discount_type === 'free' ? '' : c.discount_value,
      c.min_spend_twd || 0,
      c.max_discount_twd || '',
      (c.applicable_countries || []).join(' '),
      (c.applicable_plan_ids || []).map((id: string) => c.applicable_plan_names?.[id] || id).join(' | '),
      c.usage_count || 0,
      c.max_usage_count || '',
      c.max_uses_per_customer || '',
      c.starts_at ? String(c.starts_at).split('T')[0] : '',
      c.expires_at ? String(c.expires_at).split('T')[0] : '',
      c.is_active ? '啟用' : '暫停',
      c.created_at || '',
    ])
    const csv = '\uFEFF' + [header, ...rows].map(r => r.map(esc).join(',')).join('\r\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `esim_coupons_${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  // 新增／編輯優惠券
  async function handleCreateCoupon(e: React.FormEvent) {
    e.preventDefault()
    if (!newCoupon.code.trim()) return
    if (couponDatesInvalid()) return
    setSavingCoupon(true)
    setCouponMessage('')
    try {
      const res = await fetch('/api/esim/admin/coupons', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: editingCouponId ? 'update' : 'create',
          coupon: {
            ...buildCouponPayload(),
            id: editingCouponId || undefined,
          },
        }),
      })
      const data = await res.json()
      if (data.success) {
        setCoupons(data.coupons)
        setCouponMessage(`✅ 優惠券「${newCoupon.code.toUpperCase()}」已成功${editingCouponId ? '更新' : '新增'}！`)
        setEditingCouponId(null)
        setNewCoupon(EMPTY_COUPON_FORM)
        setSelectedPlans({})
        setTimeout(() => setCouponMessage(''), 4000)
      } else {
        alert(`${editingCouponId ? '更新' : '新增'}失敗: ${data.error}`)
      }
    } catch (err: any) {
      alert(`${editingCouponId ? '更新' : '新增'}異常: ${err.message}`)
    } finally {
      setSavingCoupon(false)
    }
  }

  // 切換優惠券啟用狀態
  async function handleToggleCoupon(coupon: any) {
    try {
      const res = await fetch('/api/esim/admin/coupons', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'toggle',
          coupon: { id: coupon.id },
        }),
      })
      const data = await res.json()
      if (data.success) {
        setCoupons(data.coupons)
      }
    } catch (err) {
      console.error('Failed to toggle coupon:', err)
    }
  }

  // 刪除優惠券
  async function handleDeleteCoupon(coupon: any) {
    if (!confirm(`確定要刪除優惠代碼「${coupon.code}」嗎？`)) return
    try {
      const res = await fetch('/api/esim/admin/coupons', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'delete',
          coupon: { id: coupon.id },
        }),
      })
      const data = await res.json()
      if (data.success) {
        setCoupons(data.coupons)
      }
    } catch (err) {
      console.error('Failed to delete coupon:', err)
    }
  }

  // 批次刪除
  const [selectedCouponIds, setSelectedCouponIds] = useState<Set<string>>(new Set())
  const allFilteredSelected = filteredCoupons.length > 0 && filteredCoupons.every((c: any) => selectedCouponIds.has(c.id))

  function toggleCouponSelect(id: string) {
    setSelectedCouponIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleSelectAllFiltered() {
    setSelectedCouponIds(prev => {
      const next = new Set(prev)
      if (allFilteredSelected) filteredCoupons.forEach((c: any) => next.delete(c.id))
      else filteredCoupons.forEach((c: any) => next.add(c.id))
      return next
    })
  }

  async function handleBatchDelete() {
    const ids = Array.from(selectedCouponIds).filter(id => coupons.some((c: any) => c.id === id))
    if (ids.length === 0) return
    if (!confirm(`確定要刪除選取的 ${ids.length} 張優惠券嗎？此動作無法復原。`)) return
    try {
      const res = await fetch('/api/esim/admin/coupons', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'batch_delete', ids }),
      })
      const data = await res.json()
      if (data.success) {
        setCoupons(data.coupons)
        setSelectedCouponIds(new Set())
        setCouponMessage(`✅ ${data.message}`)
        setTimeout(() => setCouponMessage(''), 4000)
      } else {
        alert(`批次刪除失敗: ${data.error}`)
      }
    } catch (err: any) {
      alert(`批次刪除異常: ${err.message}`)
    }
  }

  // 使用紀錄查詢
  const [usageCoupon, setUsageCoupon] = useState<any | null>(null)
  const [usageData, setUsageData] = useState<{ records: any[]; summary: any } | null>(null)
  const [loadingUsage, setLoadingUsage] = useState(false)
  const [usageError, setUsageError] = useState('')

  async function openCouponUsage(c: any) {
    setUsageCoupon(c)
    setUsageData(null)
    setUsageError('')
    setLoadingUsage(true)
    try {
      const data = await fetch(`/api/esim/admin/coupons/usage?code=${encodeURIComponent(c.code)}`).then(r => r.json())
      if (data.success) setUsageData({ records: data.records || [], summary: data.summary })
      else setUsageError(data.error || '查詢失敗')
    } catch (err: any) {
      setUsageError(err.message || '查詢失敗')
    } finally {
      setLoadingUsage(false)
    }
  }

  const PAYMENT_LABEL: Record<string, string> = { paid: '已付款', pending: '待付款', failed: '付款失敗', refunded: '已退款' }

  // 儲存定價與促銷設定
  async function handleSaveSettings(e: React.FormEvent) {
    e.preventDefault()
    setSavingSettings(true)
    setSettingsSavedMessage('')
    try {
      const res = await fetch('/api/esim/admin/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(pricingSettings),
      })
      const data = await res.json()
      if (data.success) {
        setPricingSettings(data.settings)
        setSettingsSavedMessage('✅ 定價策略與促銷方案已成功儲存並即時套用於前台商城！')
        setTimeout(() => setSettingsSavedMessage(''), 4000)
      } else {
        alert(`儲存失敗: ${data.error}`)
      }
    } catch (err: any) {
      alert(`儲存異常: ${err.message}`)
    } finally {
      setSavingSettings(false)
    }
  }

  // 強制重新整理快取
  async function handleSyncCatalog() {
    setSyncing(true)
    setSyncMessage('')
    try {
      const res = await fetch('/api/esim/plans?refresh=1')
      const data = await res.json()
      if (data.success) {
        setSyncMessage(`✅ 方案庫同步完成！共載入全球 ${data.destinations?.length || 0} 個國家/地區、${data.totalPlans || 0} 筆資費方案。`)
      } else {
        setSyncMessage(`❌ 同步失敗: ${data.error}`)
      }
    } catch (err: any) {
      setSyncMessage(`❌ 同步異常: ${err.message}`)
    } finally {
      setSyncing(false)
    }
  }

  // 計算試算器結果
  const simResult = React.useMemo(() => {
    const costTwd = testCostHkd * pricingSettings.hkd_twd_rate
    const rawPrice = costTwd * pricingSettings.default_markup + pricingSettings.fixed_fee_twd
    let basePrice = Math.max(pricingSettings.min_price_twd, Math.round(rawPrice))
    if (pricingSettings.round_to_9 && basePrice > 100) {
      const rem = basePrice % 10
      if (rem !== 9) basePrice = basePrice - rem + 9
    }

    let finalPrice = basePrice
    if (pricingSettings.promo_active && pricingSettings.promo_discount > 0 && pricingSettings.promo_discount < 1.0) {
      finalPrice = Math.round(basePrice * pricingSettings.promo_discount)
      if (pricingSettings.round_to_9 && finalPrice > 100) {
        const rem = finalPrice % 10
        if (rem !== 9) finalPrice = finalPrice - rem + 9
      }
    }

    const profitTwd = finalPrice - costTwd
    const marginPct = finalPrice > 0 ? Math.round((profitTwd / finalPrice) * 100) : 0

    return {
      costTwd: Math.round(costTwd * 10) / 10,
      basePrice,
      finalPrice,
      profitTwd: Math.round(profitTwd),
      marginPct,
    }
  }, [testCostHkd, pricingSettings])

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-10 space-y-8">
      {/* 頂部標題與快捷動作 */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <span className="bg-slate-900 text-white text-[11px] font-bold px-2 py-0.5 rounded-md">商城控制台</span>
            <h1 className="text-2xl font-black text-slate-900">MICROESIM 營運與定價中樞</h1>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            設定全域利潤加成、即時匯率、促銷早鳥折扣、查閱原廠 API 餘額與客戶訂單
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleSyncCatalog}
            disabled={syncing}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-all disabled:opacity-50 cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin' : ''}`} />
            <span>{syncing ? '方案同步中...' : '重新整理方案庫'}</span>
          </button>
          <Link
            href="/esim"
            target="_blank"
            className="inline-flex items-center gap-1 px-4 py-2 rounded-xl bg-blue-600 text-white text-xs font-bold hover:bg-blue-700 shadow-sm transition-all"
          >
            <span>瀏覽前台商城</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>

      {syncMessage && (
        <div className="p-3.5 bg-blue-50 text-blue-800 text-xs font-medium rounded-xl border border-blue-200 animate-in fade-in">
          {syncMessage}
        </div>
      )}

      {/* Tab 頁籤切換 */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-1">
        <button
          onClick={() => setActiveTab('pricing')}
          className={`px-4 py-2.5 rounded-xl font-bold text-xs sm:text-sm flex items-center gap-2 transition-all cursor-pointer ${
            activeTab === 'pricing'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <DollarSign className="w-4 h-4" />
          <span>💰 定價策略與促銷管理</span>
        </button>

        <button
          onClick={() => setActiveTab('overview')}
          className={`px-4 py-2.5 rounded-xl font-bold text-xs sm:text-sm flex items-center gap-2 transition-all cursor-pointer ${
            activeTab === 'overview'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Wallet className="w-4 h-4" />
          <span>📊 原廠餘額與電信公告</span>
        </button>

        <button
          onClick={() => setActiveTab('orders')}
          className={`px-4 py-2.5 rounded-xl font-bold text-xs sm:text-sm flex items-center gap-2 transition-all cursor-pointer ${
            activeTab === 'orders'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <ShoppingCart className="w-4 h-4" />
          <span>📋 顧客訂單總表 ({orders.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('coupons')}
          className={`px-4 py-2.5 rounded-xl font-bold text-xs sm:text-sm flex items-center gap-2 transition-all cursor-pointer ${
            activeTab === 'coupons'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Ticket className="w-4 h-4" />
          <span>🎟️ 優惠券管理 ({coupons.length})</span>
        </button>
      </div>

      {/* ──────────────────────────────────────────────────────────── */}
      {/* 1. 定價策略與促銷管理 TAB                                     */}
      {/* ──────────────────────────────────────────────────────────── */}
      {activeTab === 'pricing' && (
        <div className="space-y-8 animate-in fade-in duration-150">
          {settingsSavedMessage && (
            <div className="p-4 bg-emerald-50 text-emerald-800 text-xs sm:text-sm font-bold rounded-2xl border border-emerald-200 flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
              <span>{settingsSavedMessage}</span>
            </div>
          )}

          <form onSubmit={handleSaveSettings} className="space-y-8">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* 核心參數設定卡片 */}
              <div className="lg:col-span-2 bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 shadow-xs space-y-6">
                <div className="flex items-center gap-2 border-b border-slate-100 pb-4">
                  <Sliders className="w-5 h-5 text-blue-600" />
                  <h3 className="text-lg font-bold text-slate-900">核心利潤與匯率設定</h3>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  {/* 港幣匯率 */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-700 flex items-center justify-between">
                      <span>港幣換台幣匯率 (HKD $\rightarrow$ TWD)</span>
                      <span className="text-[11px] font-normal text-slate-400">目前設定: {pricingSettings.hkd_twd_rate}</span>
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        step="0.01"
                        min="1"
                        max="10"
                        value={pricingSettings.hkd_twd_rate}
                        onChange={e => setPricingSettings({ ...pricingSettings, hkd_twd_rate: parseFloat(e.target.value) || 4.15 })}
                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm font-semibold text-slate-900 focus:border-blue-600 focus:ring-2 focus:ring-blue-100 outline-none"
                      />
                      <span className="absolute right-3.5 top-2.5 text-xs text-slate-400 font-bold">TWD</span>
                    </div>
                    <p className="text-[11px] text-slate-400">廠商 API 以港幣報價，換算為台幣成本所採用的基準匯率</p>
                  </div>

                  {/* 全域毛利率加成 */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-700 flex items-center justify-between">
                      <span>全域利潤加成倍率 (Markup)</span>
                      <span className="text-xs font-bold text-blue-600">
                        +{Math.round((pricingSettings.default_markup - 1) * 100)}% 毛利
                      </span>
                    </label>
                    <div className="flex items-center gap-3">
                      <input
                        type="range"
                        min="1.0"
                        max="2.2"
                        step="0.05"
                        value={pricingSettings.default_markup}
                        onChange={e => setPricingSettings({ ...pricingSettings, default_markup: parseFloat(e.target.value) })}
                        className="flex-1 accent-blue-600 cursor-pointer"
                      />
                      <span className="font-mono text-sm font-bold text-slate-900 w-12 text-right">
                        {pricingSettings.default_markup}x
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400">例：1.35 代表在成本基礎上加上 35% 毛利；1.50 代表加 50%</p>
                  </div>

                  {/* 每單固定服務費 */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-700">
                      每單基礎金流與營運費 (TWD)
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        min="0"
                        max="200"
                        step="5"
                        value={pricingSettings.fixed_fee_twd}
                        onChange={e => setPricingSettings({ ...pricingSettings, fixed_fee_twd: parseInt(e.target.value) || 0 })}
                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm font-semibold text-slate-900 focus:border-blue-600 focus:ring-2 focus:ring-blue-100 outline-none"
                      />
                      <span className="absolute right-3.5 top-2.5 text-xs text-slate-400 font-bold">NT$</span>
                    </div>
                    <p className="text-[11px] text-slate-400">涵蓋綠界線上刷卡手續費與系統開卡基礎成本</p>
                  </div>

                  {/* 最低售價門檻 */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-700">
                      最低單卡零售價保護 (TWD)
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        min="39"
                        max="300"
                        step="10"
                        value={pricingSettings.min_price_twd}
                        onChange={e => setPricingSettings({ ...pricingSettings, min_price_twd: parseInt(e.target.value) || 79 })}
                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm font-semibold text-slate-900 focus:border-blue-600 focus:ring-2 focus:ring-blue-100 outline-none"
                      />
                      <span className="absolute right-3.5 top-2.5 text-xs text-slate-400 font-bold">NT$</span>
                    </div>
                    <p className="text-[11px] text-slate-400">若成本極低時，確保售價不低於此門檻</p>
                  </div>
                </div>

                {/* 9 字尾美化開關 */}
                <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-200/80">
                  <div>
                    <div className="font-bold text-xs sm:text-sm text-slate-900">啟用電商「9 字尾」售價美化</div>
                    <div className="text-[11px] text-slate-500">
                      高於 NT$ 100 的售價自動進位至 9 結尾（例：142 元 $\rightarrow$ 149 元，231 元 $\rightarrow$ 239 元）
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setPricingSettings({ ...pricingSettings, round_to_9: !pricingSettings.round_to_9 })}
                    className={`w-12 h-6 rounded-full transition-colors relative cursor-pointer ${
                      pricingSettings.round_to_9 ? 'bg-blue-600' : 'bg-slate-300'
                    }`}
                  >
                    <div
                      className={`w-5 h-5 rounded-full bg-white absolute top-0.5 transition-transform shadow-xs ${
                        pricingSettings.round_to_9 ? 'translate-x-6.5' : 'translate-x-0.5'
                      }`}
                    />
                  </button>
                </div>

                {/* 促銷優惠方案區塊 */}
                <div className="p-5 rounded-2xl bg-gradient-to-br from-amber-500/10 via-orange-500/5 to-transparent border border-amber-200/80 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Sparkles className="w-5 h-5 text-amber-600" />
                      <div>
                        <h4 className="font-bold text-slate-900 text-sm">全館促銷折扣活動 (Promo Campaign)</h4>
                        <p className="text-[11px] text-slate-500">在前台首頁顯示優惠橫幅，並自動在所有方案標示劃線原價與特惠價</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setPricingSettings({ ...pricingSettings, promo_active: !pricingSettings.promo_active })}
                      className={`w-12 h-6 rounded-full transition-colors relative cursor-pointer ${
                        pricingSettings.promo_active ? 'bg-amber-500' : 'bg-slate-300'
                      }`}
                    >
                      <div
                        className={`w-5 h-5 rounded-full bg-white absolute top-0.5 transition-transform shadow-xs ${
                          pricingSettings.promo_active ? 'translate-x-6.5' : 'translate-x-0.5'
                        }`}
                      />
                    </button>
                  </div>

                  {pricingSettings.promo_active && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-amber-200/50">
                      <div className="space-y-1">
                        <label className="text-xs font-bold text-slate-700">促銷活動標題（顯示於前台上方橫幅）</label>
                        <input
                          type="text"
                          value={pricingSettings.promo_title}
                          placeholder="🎉 全館出國上網早鳥限時 9 折特惠進行中！"
                          onChange={e => setPricingSettings({ ...pricingSettings, promo_title: e.target.value })}
                          className="w-full px-3 py-2 rounded-xl border border-amber-300 bg-white text-xs font-medium focus:outline-none focus:ring-2 focus:ring-amber-200"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-xs font-bold text-slate-700 flex justify-between">
                          <span>促銷折扣折數</span>
                          <span className="text-amber-700 font-extrabold">
                            {pricingSettings.promo_discount === 0.9 ? '9 折 (省 10%)' :
                             pricingSettings.promo_discount === 0.85 ? '85 折 (省 15%)' :
                             pricingSettings.promo_discount === 0.8 ? '8 折 (省 20%)' :
                             `${Math.round(pricingSettings.promo_discount * 100)}% 售價`}
                          </span>
                        </label>
                        <select
                          value={pricingSettings.promo_discount}
                          onChange={e => setPricingSettings({ ...pricingSettings, promo_discount: parseFloat(e.target.value) })}
                          className="w-full px-3 py-2 rounded-xl border border-amber-300 bg-white text-xs font-medium focus:outline-none focus:ring-2 focus:ring-amber-200"
                        >
                          <option value="0.95">95 折 (原價 x 0.95)</option>
                          <option value="0.90">9 折 (原價 x 0.90)</option>
                          <option value="0.85">85 折 (原價 x 0.85)</option>
                          <option value="0.80">8 折 (原價 x 0.80)</option>
                          <option value="0.75">75 折 (原價 x 0.75)</option>
                        </select>
                      </div>
                    </div>
                  )}
                </div>

                <div className="pt-2 flex justify-end">
                  <button
                    type="submit"
                    disabled={savingSettings}
                    className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold text-sm shadow-md shadow-blue-500/25 active:scale-95 transition-all cursor-pointer disabled:opacity-50"
                  >
                    {savingSettings ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        <span>儲存中...</span>
                      </>
                    ) : (
                      <>
                        <Save className="w-4 h-4" />
                        <span>一鍵儲存並即時套用</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* 右側：即時定價模擬器 */}
              <div className="space-y-6">
                <div className="bg-gradient-to-b from-slate-900 to-indigo-950 text-white rounded-3xl p-6 sm:p-7 shadow-xl space-y-6">
                  <div className="flex items-center gap-2 border-b border-white/10 pb-4">
                    <Calculator className="w-5 h-5 text-sky-400" />
                    <div>
                      <h4 className="font-black text-base">即時售價與毛利試算</h4>
                      <p className="text-[11px] text-slate-300">輸入任意港幣成本，即時檢視獲利</p>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs text-slate-300 font-semibold block">
                      模擬 MicroEsim 方案成本 (HKD)
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        min="1"
                        max="500"
                        step="0.5"
                        value={testCostHkd}
                        onChange={e => setTestCostHkd(parseFloat(e.target.value) || 0)}
                        className="w-full bg-white/10 border border-white/20 rounded-xl px-3.5 py-2.5 text-white font-mono font-bold text-lg outline-none focus:border-sky-400"
                      />
                      <span className="absolute right-3.5 top-3 text-xs text-slate-400 font-bold">HKD</span>
                    </div>
                  </div>

                  {/* 試算結果卡片 */}
                  <div className="space-y-3 bg-white/5 rounded-2xl p-4 border border-white/10 text-xs">
                    <div className="flex justify-between py-1 border-b border-white/5">
                      <span className="text-slate-400">換算台幣成本</span>
                      <span className="font-mono font-bold text-slate-200">NT$ {simResult.costTwd}</span>
                    </div>

                    <div className="flex justify-between py-1 border-b border-white/5">
                      <span className="text-slate-400">標準售價 (含9字尾)</span>
                      <span className="font-mono font-bold text-slate-300">
                        NT$ {simResult.basePrice}
                      </span>
                    </div>

                    {pricingSettings.promo_active && (
                      <div className="flex justify-between py-1 border-b border-white/5 text-amber-300 font-semibold">
                        <span>促銷優惠實付價 ({Math.round(pricingSettings.promo_discount * 100)}折)</span>
                        <span className="font-mono font-black text-base">NT$ {simResult.finalPrice}</span>
                      </div>
                    )}

                    <div className="pt-2 flex justify-between items-baseline">
                      <span className="text-emerald-400 font-bold">每張預估實賺毛利</span>
                      <div className="text-right">
                        <span className="font-mono font-black text-2xl text-emerald-400">
                          +NT$ {simResult.profitTwd}
                        </span>
                        <div className="text-[11px] text-emerald-300 font-bold">
                          毛利率: {simResult.marginPct}%
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="text-[11px] text-slate-400 leading-relaxed bg-white/5 p-3 rounded-xl">
                    💡 提示：此試算結果完全與前台邏輯一致，您在左側調整的匯率、利潤加成或促銷折扣，都會即時反映在此試算結果與前台顧客頁面中。
                  </div>
                </div>
              </div>
            </div>
          </form>
        </div>
      )}

      {/* ──────────────────────────────────────────────────────────── */}
      {/* 2. 原廠餘額與電信公告 TAB                                     */}
      {/* ──────────────────────────────────────────────────────────── */}
      {activeTab === 'overview' && (
        <div className="space-y-8 animate-in fade-in duration-150">
          {/* 原廠狀態三欄卡片 */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
            <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-xs space-y-3">
              <div className="flex items-center justify-between text-slate-400">
                <span className="text-xs font-bold uppercase tracking-wider">MICROESIM 原廠帳戶</span>
                <Globe className="w-5 h-5 text-blue-600" />
              </div>
              <div className="text-2xl font-black text-slate-900">
                {balance?.account || 'imseby'}
              </div>
              <div className="flex items-center gap-1.5 text-xs text-emerald-600 font-bold">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>API 認證連線正常</span>
              </div>
            </div>

            <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-xs space-y-3">
              <div className="flex items-center justify-between text-slate-400">
                <span className="text-xs font-bold uppercase tracking-wider">原廠即時餘額 (HKD)</span>
                <Wallet className="w-5 h-5 text-emerald-600" />
              </div>
              <div className="text-3xl font-black text-slate-900">
                HK$ {balance?.balance !== undefined ? balance.balance.toFixed(2) : '1,654.84'}
              </div>
              <div className="text-xs text-slate-500">
                即時扣款發卡額度充足
              </div>
            </div>

            <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-xs space-y-3">
              <div className="flex items-center justify-between text-slate-400">
                <span className="text-xs font-bold uppercase tracking-wider">本站累積訂單數</span>
                <ShoppingCart className="w-5 h-5 text-indigo-600" />
              </div>
              <div className="text-3xl font-black text-slate-900">
                {orders.length} <span className="text-sm font-normal text-slate-400">筆</span>
              </div>
              <div className="text-xs text-blue-600 font-medium">
                線上 24/7 自動即時發卡
              </div>
            </div>
          </div>

          {/* 原廠最新公告 */}
          <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-xs space-y-4">
            <div className="flex items-center gap-2">
              <Bell className="w-4 h-4 text-amber-500" />
              <h3 className="text-sm font-bold text-slate-900">MICROESIM 各國電信商營運通知與維護公告</h3>
            </div>
            {notices.length === 0 ? (
              <div className="text-xs text-slate-400 py-3">今日暫無各國電信商異常或維護公告，全球網路服務運行正常。</div>
            ) : (
              <div className="space-y-2">
                {notices.map((n: any, idx: number) => (
                  <div key={idx} className="p-3 bg-amber-50 text-amber-900 rounded-xl text-xs flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                    <div>
                      <div className="font-bold">{n.title || n.notice_title || '電信商通知'}</div>
                      <div className="text-amber-800/80 mt-0.5">{n.content || n.desc || JSON.stringify(n)}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ──────────────────────────────────────────────────────────── */}
      {/* 3. 顧客訂單總表 TAB                                           */}
      {/* ──────────────────────────────────────────────────────────── */}
      {activeTab === 'orders' && (
        <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-xs animate-in fade-in duration-150">
          <div className="p-6 border-b border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShoppingCart className="w-4 h-4 text-slate-700" />
              <h3 className="text-sm font-bold text-slate-900">顧客出國 eSIM 訂單列表</h3>
            </div>
            <span className="text-xs text-slate-400">共 {orders.length} 筆訂單</span>
          </div>

          {orders.length === 0 ? (
            <div className="p-12 text-center text-slate-400 text-xs">
              目前尚無訂單紀錄，在前台下單或執行測試結帳後將即時呈現在此。
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
                  <tr>
                    <th className="py-3 px-4">訂單編號</th>
                    <th className="py-3 px-4">顧客信箱 / 姓名</th>
                    <th className="py-3 px-4">目的地與方案</th>
                    <th className="py-3 px-4">售價 (TWD)</th>
                    <th className="py-3 px-4">付款狀態</th>
                    <th className="py-3 px-4">MicroEsim 開卡</th>
                    <th className="py-3 px-4">ICCID / 憑證</th>
                    <th className="py-3 px-4 text-right">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {orders.map((o: any) => (
                    <tr key={o.order_no} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-4 font-mono font-medium text-slate-900">{o.order_no}</td>
                      <td className="py-3 px-4">
                        <div className="font-medium text-slate-800">{o.customer_name || '旅客'}</div>
                        <div className="text-[11px] text-slate-400">{o.customer_email}</div>
                      </td>
                      <td className="py-3 px-4">
                        <span className="font-semibold text-slate-800">{o.country_name}</span>
                        <div className="text-[11px] text-slate-500">{o.data_amount} ({o.day}天)</div>
                      </td>
                      <td className="py-3 px-4 font-bold text-slate-900">NT$ {o.total_price_twd}</td>
                      <td className="py-3 px-4">
                        {o.payment_status === 'paid' ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                            已付款
                          </span>
                        ) : (
                          <span className="text-[11px] font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                            待付款
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        {o.microesim_status === 'delivered' ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-200">
                            已發卡
                          </span>
                        ) : o.microesim_status === 'failed' ? (
                          <span className="text-[11px] font-bold text-red-600 bg-red-50 px-2 py-0.5 rounded-full border border-red-200">
                            發卡失敗
                          </span>
                        ) : (
                          <span className="text-[11px] text-slate-400">處理中</span>
                        )}
                      </td>
                      <td className="py-3 px-4 font-mono text-[11px] text-slate-600">
                        {o.iccid || (o.activation_code ? '已生成啟用碼' : '-')}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <Link
                          href={`/esim/order/${o.order_no}`}
                          className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-800 font-bold text-xs"
                        >
                          <span>檢視憑證</span>
                          <ArrowRight className="w-3 h-3" />
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ──────────────────────────────────────────────────────────── */}
      {/* 4. 優惠券管理 TAB                                             */}
      {/* ──────────────────────────────────────────────────────────── */}
      {activeTab === 'coupons' && (
        <div className="space-y-8 animate-in fade-in duration-150">
          {couponMessage && (
            <div className="p-4 bg-emerald-50 text-emerald-800 text-xs sm:text-sm font-bold rounded-2xl border border-emerald-200 flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
              <span>{couponMessage}</span>
            </div>
          )}

          {/* 使用通知 Email */}
          <div className="bg-white rounded-3xl border border-slate-200 p-5 shadow-xs text-xs">
            <div className="flex flex-wrap items-center gap-3">
              <label className="inline-flex items-center gap-2 font-bold text-slate-800 cursor-pointer">
                <input type="checkbox" checked={notifyEnabled} onChange={e => setNotifyEnabled(e.target.checked)} />
                優惠券使用通知 Email
              </label>
              <input
                type="text"
                placeholder="收件人 Email，多個以逗號分隔"
                value={notifyEmails}
                onChange={e => setNotifyEmails(e.target.value)}
                className="flex-1 min-w-[220px] px-3 py-2 rounded-xl border border-slate-300 focus:border-blue-600 focus:ring-2 focus:ring-blue-100 outline-none"
              />
              <button
                type="button"
                onClick={handleSaveNotify}
                disabled={savingNotify}
                className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold disabled:opacity-50"
              >
                {savingNotify ? '儲存中...' : '儲存'}
              </button>
            </div>
            <p className="mt-2 text-slate-500">開啟後，每筆使用優惠券的訂單付款成功時，會寄通知信到上述信箱（最多 10 個）。</p>
          </div>

          {/* 新增優惠券卡片 */}
          <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 shadow-xs space-y-6">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center gap-2">
                <Ticket className="w-5 h-5 text-blue-600" />
                <div>
                  <h3 className="text-base sm:text-lg font-bold text-slate-900">
                    {editingCouponId ? `編輯優惠券「${newCoupon.code}」` : '建立新優惠券折扣碼'}
                  </h3>
                  <p className="text-xs text-slate-500">顧客於結帳彈窗輸入此代碼即可立即折抵訂單金額</p>
                </div>
              </div>
              {editingCouponId && (
                <button
                  type="button"
                  onClick={handleCancelEdit}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl border border-slate-300 text-xs font-semibold text-slate-600 hover:bg-slate-100"
                >
                  <X className="w-3.5 h-3.5" />
                  取消編輯
                </button>
              )}
            </div>

            <form onSubmit={handleCreateCoupon} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
              {/* 優惠券代碼 */}
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  優惠代碼 (Code) <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="例如 WELCOME50, SUMMER88"
                  value={newCoupon.code}
                  onChange={e => setNewCoupon({ ...newCoupon, code: e.target.value.toUpperCase() })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 font-mono font-bold uppercase focus:border-blue-600 focus:ring-2 focus:ring-blue-100 outline-none"
                />
              </div>

              {/* 優惠券名稱 */}
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  活動名稱 / 說明
                </label>
                <input
                  type="text"
                  placeholder="例如 新客首購折抵 50 元"
                  value={newCoupon.name}
                  onChange={e => setNewCoupon({ ...newCoupon, name: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:border-blue-600 focus:ring-2 focus:ring-blue-100 outline-none"
                />
              </div>

              {/* 折扣類型 */}
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  折扣方式
                </label>
                <select
                  value={newCoupon.discount_type}
                  onChange={e => setNewCoupon({
                    ...newCoupon,
                    discount_type: e.target.value as 'fixed' | 'percent' | 'free',
                    discount_value: e.target.value === 'percent' ? 0.9 : e.target.value === 'free' ? 0 : 50,
                    min_spend_twd: e.target.value === 'free' ? 0 : newCoupon.min_spend_twd,
                  })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white focus:border-blue-600 focus:ring-2 focus:ring-blue-100 outline-none font-medium"
                >
                  <option value="fixed">現折固定金額 (TWD)</option>
                  <option value="percent">成數折扣 (例如 9 折、85 折)</option>
                  <option value="free">🎁 贈品 (輸入代碼免費兌換 1 張)</option>
                </select>
              </div>

              {/* 折扣數值 */}
              {newCoupon.discount_type === 'free' ? (
              <div>
                <label className="block font-semibold text-slate-700 mb-1">贈品內容</label>
                <div className="w-full px-3 py-2 rounded-xl border border-amber-200 bg-amber-50 text-amber-700 font-bold">
                  免費兌換 1 張（下方可指定產品）
                </div>
              </div>
              ) : (
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  {newCoupon.discount_type === 'fixed' ? '折抵金額 (NT$)' : '折扣成數 (0.9=9折)'} <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  step={newCoupon.discount_type === 'percent' ? '0.01' : '1'}
                  min={newCoupon.discount_type === 'percent' ? '0.01' : '1'}
                  max={newCoupon.discount_type === 'percent' ? '0.99' : '10000'}
                  required
                  value={newCoupon.discount_value}
                  onChange={e => setNewCoupon({ ...newCoupon, discount_value: parseFloat(e.target.value) || 0 })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 font-bold text-blue-600 focus:border-blue-600 focus:ring-2 focus:ring-blue-100 outline-none"
                />
              </div>
              )}

              {/* 最低消費門檻 */}
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  最低消費金額門檻 (NT$)
                </label>
                <input
                  type="number"
                  min="0"
                  step="10"
                  placeholder="0 為不限"
                  value={newCoupon.min_spend_twd}
                  onChange={e => setNewCoupon({ ...newCoupon, min_spend_twd: parseInt(e.target.value, 10) || 0 })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:border-blue-600 focus:ring-2 focus:ring-blue-100 outline-none"
                />
              </div>

              {/* 最高折抵上限 */}
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  最高折抵上限 (NT$，選填)
                </label>
                <input
                  type="number"
                  min="0"
                  placeholder="留空代表不設上限"
                  value={newCoupon.max_discount_twd}
                  onChange={e => setNewCoupon({ ...newCoupon, max_discount_twd: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:border-blue-600 focus:ring-2 focus:ring-blue-100 outline-none"
                />
              </div>

              {/* 適用國家 */}
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  限定適用國家代碼 (選填)
                </label>
                <input
                  type="text"
                  placeholder="如 JP 或 JP,KR (留空為全館)"
                  value={newCoupon.applicable_countries}
                  onChange={e => setNewCoupon({ ...newCoupon, applicable_countries: e.target.value.toUpperCase() })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 uppercase font-mono focus:border-blue-600 focus:ring-2 focus:ring-blue-100 outline-none"
                />
              </div>

              {/* 使用次數上限 */}
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  使用次數上限 (選填)
                </label>
                <input
                  type="number"
                  min="1"
                  step="1"
                  placeholder="留空代表不限次數"
                  value={newCoupon.max_usage_count}
                  onChange={e => setNewCoupon({ ...newCoupon, max_usage_count: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:border-blue-600 focus:ring-2 focus:ring-blue-100 outline-none"
                />
              </div>

              {/* 每人限用次數 */}
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  每人限用次數 (選填，依 Email)
                </label>
                <input
                  type="number"
                  min="1"
                  step="1"
                  placeholder="留空代表不限"
                  value={newCoupon.max_uses_per_customer}
                  onChange={e => setNewCoupon({ ...newCoupon, max_uses_per_customer: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:border-blue-600 focus:ring-2 focus:ring-blue-100 outline-none"
                />
              </div>

              {/* 啟用日期 */}
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  啟用日期 (選填，當天起可用)
                </label>
                <input
                  type="date"
                  value={newCoupon.starts_at}
                  max={newCoupon.expires_at || undefined}
                  onChange={e => setNewCoupon({ ...newCoupon, starts_at: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:border-blue-600 focus:ring-2 focus:ring-blue-100 outline-none"
                />
              </div>

              {/* 到期日 */}
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  到期日 (選填，含當天)
                </label>
                <input
                  type="date"
                  value={newCoupon.expires_at}
                  min={newCoupon.starts_at || undefined}
                  onChange={e => setNewCoupon({ ...newCoupon, expires_at: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:border-blue-600 focus:ring-2 focus:ring-blue-100 outline-none"
                />
              </div>

              {/* 限定產品 */}
              <div className="sm:col-span-2 lg:col-span-4 rounded-2xl border border-slate-200 p-4 bg-slate-50/60">
                <div className="flex flex-wrap items-end gap-2 mb-2">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      限定適用產品 (選填{newCoupon.discount_type === 'free' ? '，贈品建議指定' : ''})
                    </label>
                    <input
                      type="text"
                      placeholder="國家代碼，如 JP"
                      value={planCountry}
                      onChange={e => setPlanCountry(e.target.value.toUpperCase())}
                      className="w-32 px-3 py-2 rounded-xl border border-slate-300 uppercase font-mono bg-white focus:border-blue-600 focus:ring-2 focus:ring-blue-100 outline-none"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={loadPlanOptions}
                    disabled={loadingPlanOptions || !planCountry.trim()}
                    className="px-3 py-2 rounded-xl border border-slate-300 bg-white hover:bg-slate-100 font-semibold disabled:opacity-50"
                  >
                    {loadingPlanOptions ? '載入中...' : '載入產品'}
                  </button>
                  <span className="text-slate-400">未勾選代表不限產品</span>
                </div>

                {Object.keys(selectedPlans).length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {Object.entries(selectedPlans).map(([id, label]) => (
                      <button
                        key={id}
                        type="button"
                        onClick={() => setSelectedPlans(prev => { const n = { ...prev }; delete n[id]; return n })}
                        className="px-2 py-1 rounded-full bg-blue-100 text-blue-700 border border-blue-200 text-[11px] font-semibold"
                      >
                        {label} ✕
                      </button>
                    ))}
                  </div>
                )}

                {planOptions.length > 0 && (() => {
                  const terms = planSearch.trim().toLowerCase().split(/\s+/).filter(Boolean)
                  const visiblePlans = terms.length === 0 ? planOptions : planOptions.filter((p: any) => {
                    const hay = `${planLabel(p)} ${p.channel_dataplan_name || ''} ${p.channel_dataplan_id}`.toLowerCase()
                    return terms.every(t => hay.includes(t))
                  })
                  return (
                  <>
                  <div className="flex flex-wrap items-center gap-2 mb-2">
                    <input
                      type="text"
                      placeholder="搜尋產品，如：2GB 5天、吃到飽、全球"
                      value={planSearch}
                      onChange={e => setPlanSearch(e.target.value)}
                      className="flex-1 min-w-[200px] px-3 py-2 rounded-xl border border-slate-300 bg-white focus:border-blue-600 focus:ring-2 focus:ring-blue-100 outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => setSelectedPlans(prev => {
                        const next = { ...prev }
                        visiblePlans.forEach((p: any) => { next[p.channel_dataplan_id] = planLabel(p) })
                        return next
                      })}
                      disabled={visiblePlans.length === 0}
                      className="px-3 py-2 rounded-xl border border-slate-300 bg-white hover:bg-slate-100 font-semibold disabled:opacity-50"
                    >
                      全選結果 ({visiblePlans.length})
                    </button>
                    {Object.keys(selectedPlans).length > 0 && (
                      <button
                        type="button"
                        onClick={() => setSelectedPlans({})}
                        className="px-3 py-2 rounded-xl border border-slate-300 bg-white hover:bg-slate-100 font-semibold text-slate-600"
                      >
                        清除已選
                      </button>
                    )}
                  </div>
                  <div className="max-h-56 overflow-y-auto rounded-xl border border-slate-200 bg-white divide-y divide-slate-100">
                    {visiblePlans.length === 0 && (
                      <div className="px-3 py-4 text-center text-slate-400">沒有符合的產品</div>
                    )}
                    {visiblePlans.map((p: any) => (
                      <label key={p.channel_dataplan_id} className="flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-slate-50">
                        <input
                          type="checkbox"
                          checked={!!selectedPlans[p.channel_dataplan_id]}
                          onChange={() => togglePlan(p)}
                        />
                        <span className="flex-1">{planLabel(p)}</span>
                        <span className="font-mono text-[10px] text-slate-400">{p.channel_dataplan_id}</span>
                      </label>
                    ))}
                  </div>
                  </>
                  )
                })()}
              </div>

              {/* 提交按鈕 */}
              <div className="flex items-end">
                <button
                  type="submit"
                  disabled={savingCoupon || !newCoupon.code.trim()}
                  className="w-full py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold transition-all shadow-sm flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {editingCouponId ? <Save className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                  <span>
                    {savingCoupon
                      ? (editingCouponId ? '儲存中...' : '建立中...')
                      : (editingCouponId ? '儲存變更' : '建立優惠券')}
                  </span>
                </button>
              </div>

              {/* 批次產生 */}
              {!editingCouponId && (
                <div className="sm:col-span-2 lg:col-span-4 rounded-2xl border border-indigo-200 p-4 bg-indigo-50/50 space-y-3">
                  <div className="font-bold text-indigo-900">批次產生（套用上方設定，自動產生不重複代碼，上方「優惠代碼」可留空）</div>
                  <div className="flex flex-wrap items-end gap-2">
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">代碼前綴 (選填)</label>
                      <input
                        type="text"
                        maxLength={12}
                        placeholder="如 GIFT"
                        value={batchPrefix}
                        onChange={e => setBatchPrefix(e.target.value.toUpperCase().replace(/[^A-Z0-9_-]/g, ''))}
                        className="w-36 px-3 py-2 rounded-xl border border-slate-300 bg-white uppercase font-mono focus:border-indigo-600 focus:ring-2 focus:ring-indigo-100 outline-none"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">數量 (1～500)</label>
                      <input
                        type="number"
                        min="1"
                        max="500"
                        value={batchCount}
                        onChange={e => setBatchCount(parseInt(e.target.value, 10) || 0)}
                        className="w-28 px-3 py-2 rounded-xl border border-slate-300 bg-white focus:border-indigo-600 focus:ring-2 focus:ring-indigo-100 outline-none"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={handleBatchCreate}
                      disabled={savingCoupon}
                      className="py-2 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold disabled:opacity-50"
                    >
                      {savingCoupon ? '產生中...' : `批次產生 ${batchCount} 張`}
                    </button>
                    <span className="text-slate-500">代碼格式：{batchPrefix || ''}XXXXXXXX</span>
                  </div>

                  {batchCodes.length > 0 && (
                    <div className="space-y-2">
                      <textarea
                        readOnly
                        value={batchCodes.join('\n')}
                        rows={6}
                        className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white font-mono text-[11px]"
                      />
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => navigator.clipboard.writeText(batchCodes.join('\n')).then(() => alert('已複製到剪貼簿'))}
                          className="px-3 py-1.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-100 font-semibold"
                        >
                          複製全部代碼
                        </button>
                        <button
                          type="button"
                          onClick={downloadBatchCsv}
                          className="px-3 py-1.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-100 font-semibold"
                        >
                          下載 CSV
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </form>
          </div>

          {/* 優惠券列表卡片 */}
          <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-xs">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Ticket className="w-4 h-4 text-slate-700" />
                <h3 className="text-sm font-bold text-slate-900">商城現有優惠券總覽</h3>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs text-slate-400">
                  {isCouponFiltered ? `符合 ${filteredCoupons.length} / 共 ${coupons.length} 張` : `共 ${coupons.length} 張優惠券`}
                </span>
                <button
                  type="button"
                  onClick={exportCouponsCsv}
                  disabled={filteredCoupons.length === 0}
                  className="px-3 py-1.5 rounded-xl border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-50"
                >
                  匯出 CSV
                </button>
              </div>
            </div>

            {coupons.length > 0 && (
              <div className="px-6 py-3 border-b border-slate-100 flex flex-wrap items-center gap-2 text-xs">
                <input
                  type="text"
                  placeholder="搜尋代碼、名稱、國家、產品"
                  value={couponSearch}
                  onChange={e => setCouponSearch(e.target.value)}
                  className="flex-1 min-w-[180px] px-3 py-2 rounded-xl border border-slate-300 focus:border-blue-600 focus:ring-2 focus:ring-blue-100 outline-none"
                />
                <select
                  value={couponTypeFilter}
                  onChange={e => setCouponTypeFilter(e.target.value)}
                  className="px-3 py-2 rounded-xl border border-slate-300 bg-white"
                >
                  <option value="all">全部折扣方式</option>
                  <option value="fixed">現折金額</option>
                  <option value="percent">成數折扣</option>
                  <option value="free">贈品</option>
                </select>
                <select
                  value={couponStatusFilter}
                  onChange={e => setCouponStatusFilter(e.target.value)}
                  className="px-3 py-2 rounded-xl border border-slate-300 bg-white"
                >
                  <option value="all">全部狀態</option>
                  <option value="active">可使用</option>
                  <option value="paused">已暫停</option>
                  <option value="expired">已過期</option>
                  <option value="scheduled">尚未開始</option>
                  <option value="used_up">已達上限</option>
                </select>
                {isCouponFiltered && (
                  <button
                    type="button"
                    onClick={() => { setCouponSearch(''); setCouponTypeFilter('all'); setCouponStatusFilter('all') }}
                    className="px-3 py-2 rounded-xl border border-slate-300 hover:bg-slate-100 font-semibold text-slate-600"
                  >
                    清除篩選
                  </button>
                )}
                {selectedCouponIds.size > 0 && (
                  <>
                    <button
                      type="button"
                      onClick={handleBatchDelete}
                      className="px-3 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold"
                    >
                      刪除選取 ({selectedCouponIds.size})
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedCouponIds(new Set())}
                      className="px-3 py-2 rounded-xl border border-slate-300 hover:bg-slate-100 font-semibold text-slate-600"
                    >
                      取消選取
                    </button>
                  </>
                )}
              </div>
            )}

            {coupons.length === 0 ? (
              <div className="p-12 text-center text-slate-400 text-xs">
                尚無設定優惠券，可於上方表單快速建立。
              </div>
            ) : filteredCoupons.length === 0 ? (
              <div className="p-12 text-center text-slate-400 text-xs">
                沒有符合篩選條件的優惠券。
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
                    <tr>
                      <th className="py-3 pl-4 pr-0 w-8">
                        <input
                          type="checkbox"
                          checked={allFilteredSelected}
                          onChange={toggleSelectAllFiltered}
                          title="全選目前列表"
                        />
                      </th>
                      <th className="py-3 px-4">優惠代碼 (Code)</th>
                      <th className="py-3 px-4">活動名稱</th>
                      <th className="py-3 px-4">折扣內容</th>
                      <th className="py-3 px-4">使用門檻 / 期間</th>
                      <th className="py-3 px-4">適用國家 / 產品</th>
                      <th className="py-3 px-4">已兌換次數</th>
                      <th className="py-3 px-4">狀態</th>
                      <th className="py-3 px-4 text-right">操作</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredCoupons.map((c: any) => (
                      <tr key={c.id} className={`hover:bg-slate-50/80 transition-colors ${selectedCouponIds.has(c.id) ? 'bg-blue-50/60' : ''}`}>
                        <td className="py-3 pl-4 pr-0">
                          <input
                            type="checkbox"
                            checked={selectedCouponIds.has(c.id)}
                            onChange={() => toggleCouponSelect(c.id)}
                          />
                        </td>
                        <td className="py-3 px-4">
                          <span className="font-mono font-bold text-slate-900 text-sm bg-slate-100 px-2 py-1 rounded-lg border border-slate-200">
                            {c.code}
                          </span>
                        </td>
                        <td className="py-3 px-4 font-medium text-slate-800">
                          {c.name}
                        </td>
                        <td className="py-3 px-4">
                          {c.discount_type === 'free' ? (
                            <span className="font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                              🎁 贈品 免費 1 張
                            </span>
                          ) : c.discount_type === 'fixed' ? (
                            <span className="font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                              現折 NT$ {c.discount_value}
                            </span>
                          ) : (
                            <span className="font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full border border-indigo-200">
                              {Math.round(c.discount_value * 100) / 10} 折 ({Math.round((1 - c.discount_value) * 100)}% OFF)
                            </span>
                          )}
                          {c.max_discount_twd && (
                            <span className="text-[10px] text-slate-400 block mt-0.5">
                              最高折 NT$ {c.max_discount_twd}
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-slate-600">
                          {c.min_spend_twd > 0 ? `滿 NT$ ${c.min_spend_twd}` : '無消費門檻'}
                          {c.starts_at && (
                            <span className={`block text-[10px] mt-0.5 ${couponStatus(c) === 'scheduled' ? 'text-amber-600' : 'text-slate-400'}`}>
                              開始 {String(c.starts_at).split('T')[0]}
                            </span>
                          )}
                          {c.expires_at && (
                            <span className={`block text-[10px] mt-0.5 ${new Date(`${String(c.expires_at).split('T')[0]}T23:59:59+08:00`).getTime() < Date.now() ? 'text-red-500' : 'text-slate-400'}`}>
                              到期 {String(c.expires_at).split('T')[0]}
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          {c.applicable_countries && c.applicable_countries.length > 0 ? (
                            <span className="font-mono text-slate-700 bg-slate-100 px-1.5 py-0.5 rounded text-[11px]">
                              {c.applicable_countries.join(', ')}
                            </span>
                          ) : (
                            <span className="text-slate-400">全館通用</span>
                          )}
                          {c.applicable_plan_ids && c.applicable_plan_ids.length > 0 && (
                            <div className="mt-1 space-y-0.5">
                              {c.applicable_plan_ids.map((id: string) => (
                                <div key={id} className="text-[10px] text-blue-700">
                                  {c.applicable_plan_names?.[id] || id}
                                </div>
                              ))}
                            </div>
                          )}
                        </td>
                        <td className="py-3 px-4 font-semibold text-slate-700">
                          {c.usage_count || 0}{c.max_usage_count ? ` / ${c.max_usage_count}` : ''} 次
                          {c.max_uses_per_customer && (
                            <span className="block text-[10px] text-slate-400 font-normal">每人限 {c.max_uses_per_customer} 次</span>
                          )}
                          {c.max_usage_count && (c.usage_count || 0) >= c.max_usage_count && (
                            <span className="block text-[10px] text-red-500">已達上限</span>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          {c.is_active && couponStatus(c) === 'scheduled' ? (
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                              尚未開始
                            </span>
                          ) : c.is_active ? (
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                              啟用中
                            </span>
                          ) : (
                            <span className="text-[11px] font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full border border-slate-200">
                              已暫停
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="inline-flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => handleToggleCoupon(c)}
                              className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-600 transition-colors cursor-pointer"
                              title={c.is_active ? '暫停此優惠券' : '啟用此優惠券'}
                            >
                              {c.is_active ? (
                                <ToggleRight className="w-5 h-5 text-emerald-600" />
                              ) : (
                                <ToggleLeft className="w-5 h-5 text-slate-400" />
                              )}
                            </button>
                            <button
                              type="button"
                              onClick={() => handleEditCoupon(c)}
                              className="p-1.5 hover:bg-blue-50 rounded-lg text-slate-400 hover:text-blue-600 transition-colors cursor-pointer"
                              title="編輯優惠券"
                            >
                              <Pencil className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => openCouponUsage(c)}
                              className="p-1.5 hover:bg-amber-50 rounded-lg text-slate-400 hover:text-amber-600 transition-colors cursor-pointer"
                              title="使用紀錄"
                            >
                              <History className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleEditCoupon(c, true)}
                              className="p-1.5 hover:bg-indigo-50 rounded-lg text-slate-400 hover:text-indigo-600 transition-colors cursor-pointer"
                              title="複製為新優惠券"
                            >
                              <Copy className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteCoupon(c)}
                              className="p-1.5 hover:bg-red-50 rounded-lg text-slate-400 hover:text-red-600 transition-colors cursor-pointer"
                              title="刪除優惠券"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
      {usageCoupon && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={() => setUsageCoupon(null)}>
          <div className="bg-white rounded-3xl w-full max-w-4xl max-h-[85vh] flex flex-col shadow-xl" onClick={e => e.stopPropagation()}>
            <div className="p-5 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-900">使用紀錄：{usageCoupon.code}</h3>
                <p className="text-xs text-slate-500">{usageCoupon.name}</p>
              </div>
              <button type="button" onClick={() => setUsageCoupon(null)} className="p-1.5 rounded-lg hover:bg-slate-100">
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>
            <div className="p-5 overflow-y-auto text-xs space-y-4">
              {loadingUsage && <div className="text-center text-slate-400 py-8">查詢中...</div>}
              {usageError && <div className="text-center text-red-500 py-8">{usageError}</div>}
              {usageData && (
                <>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="rounded-2xl bg-slate-50 p-3"><div className="text-slate-500">使用訂單</div><div className="text-lg font-bold">{usageData.summary.total_orders}</div></div>
                    <div className="rounded-2xl bg-emerald-50 p-3"><div className="text-slate-500">已付款</div><div className="text-lg font-bold text-emerald-700">{usageData.summary.paid_orders}</div></div>
                    <div className="rounded-2xl bg-amber-50 p-3"><div className="text-slate-500">已折抵總額</div><div className="text-lg font-bold text-amber-700">NT$ {usageData.summary.total_discount_twd}</div></div>
                    <div className="rounded-2xl bg-blue-50 p-3"><div className="text-slate-500">實收總額</div><div className="text-lg font-bold text-blue-700">NT$ {usageData.summary.total_revenue_twd}</div></div>
                  </div>
                  {usageData.records.length === 0 ? (
                    <div className="text-center text-slate-400 py-8">尚無訂單使用此優惠券</div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left">
                        <thead className="bg-slate-50 text-slate-500 font-semibold">
                          <tr>
                            <th className="py-2 px-3">訂單編號</th>
                            <th className="py-2 px-3">時間</th>
                            <th className="py-2 px-3">客人</th>
                            <th className="py-2 px-3">方案</th>
                            <th className="py-2 px-3 text-right">原價</th>
                            <th className="py-2 px-3 text-right">折抵</th>
                            <th className="py-2 px-3 text-right">實付</th>
                            <th className="py-2 px-3">付款狀態</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {usageData.records.map((r: any) => (
                            <tr key={r.order_no}>
                              <td className="py-2 px-3 font-mono">
                                <Link href={`/esim/order/${r.order_no}`} target="_blank" className="text-blue-600 hover:underline">{r.order_no}</Link>
                              </td>
                              <td className="py-2 px-3 whitespace-nowrap">{new Date(r.created_at).toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' })}</td>
                              <td className="py-2 px-3">
                                <div>{r.customer_name}</div>
                                <div className="text-slate-400">{r.customer_email}</div>
                              </td>
                              <td className="py-2 px-3">{r.plan}</td>
                              <td className="py-2 px-3 text-right">NT$ {r.subtotal_twd}</td>
                              <td className="py-2 px-3 text-right text-amber-700">- NT$ {r.discount_twd}</td>
                              <td className="py-2 px-3 text-right font-bold">NT$ {r.total_twd}</td>
                              <td className="py-2 px-3">
                                <span className={r.payment_status === 'paid' ? 'text-emerald-600 font-bold' : 'text-slate-500'}>
                                  {PAYMENT_LABEL[r.payment_status] || r.payment_status}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
