'use client'

import React, { useState, useEffect, useMemo } from 'react'
import { createPortal } from 'react-dom'
import Link from 'next/link'
import {
  Search, Wifi, ShieldCheck, Zap, Globe, Smartphone, Check, Clock,
  ChevronRight, AlertCircle, ShoppingCart, Sparkles, HelpCircle,
  QrCode, CreditCard, ArrowRight, CheckCircle2, RefreshCw, X, Radio
} from 'lucide-react'

interface Destination {
  code: string
  name: string
  nameEn: string
  flag: string
  region: string
  popular: boolean
  description: string
  planCount: number
  minPriceTwd: number
}

interface EsimPlan {
  channel_dataplan_id: string
  channel_dataplan_name: string
  price: string
  currency: string
  day: number
  data: string
  planType: 'daily' | 'total' | 'unlimited'
  dataTierLabel: string
  retailPriceTwd: number
  costHkd: number
  primaryCountryCode: string
  primaryCountryName: string
  flagEmoji: string
  apn: string
  networks: string
  rule_desc: string
  special_desc?: string
}

export default function EsimShopPage() {
  const [destinations, setDestinations] = useState<Destination[]>([])
  const [plans, setPlans] = useState<EsimPlan[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCountry, setSelectedCountry] = useState<string>('JP')
  
  // 方案篩選狀態
  const [planTypeFilter, setPlanTypeFilter] = useState<'all' | 'daily' | 'total' | 'unlimited'>('all')
  const [dayFilter, setDayFilter] = useState<number | 'all'>('all')

  // 結帳 Modal
  const [checkoutPlan, setCheckoutPlan] = useState<EsimPlan | null>(null)
  const [customerEmail, setCustomerEmail] = useState('')
  const [customerName, setCustomerName] = useState('')
  const [customerPhone, setCustomerPhone] = useState('')
  const [quantity, setQuantity] = useState(1)
  const [paymentMethod, setPaymentMethod] = useState<'ecpay' | 'test_mode'>('ecpay')
  const [submitting, setSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [mounted, setMounted] = useState(false)

  // 機型檢測器狀態
  const [deviceBrand, setDeviceBrand] = useState<'apple' | 'samsung' | 'google' | 'other'>('apple')

  useEffect(() => {
    setMounted(true)
  }, [])

  // 彈窗開啟時鎖定背景捲軸，並監聽 ESC 鍵以關閉彈窗
  useEffect(() => {
    if (checkoutPlan) {
      document.body.style.overflow = 'hidden'
      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape') setCheckoutPlan(null)
      }
      window.addEventListener('keydown', handleKeyDown)
      return () => {
        document.body.style.overflow = ''
        window.removeEventListener('keydown', handleKeyDown)
      }
    } else {
      document.body.style.overflow = ''
    }
  }, [checkoutPlan])

  // 1. 初次載入熱門目的地與預設日本方案
  useEffect(() => {
    fetchPlans(selectedCountry)
  }, [selectedCountry])

  async function fetchPlans(countryCode?: string) {
    try {
      setLoading(true)
      const url = countryCode
        ? `/api/esim/plans?country=${countryCode}`
        : `/api/esim/plans`
      const res = await fetch(url)
      const data = await res.json()
      if (data.success) {
        setDestinations(data.destinations || [])
        setPlans(data.plans || [])
      }
    } catch (err) {
      console.error('Failed to load plans:', err)
    } finally {
      setLoading(false)
    }
  }

  // 依照搜尋關鍵字過濾目的地
  const filteredDestinations = useMemo(() => {
    if (!searchQuery.trim()) return destinations
    const q = searchQuery.toLowerCase()
    return destinations.filter(d => 
      d.name.toLowerCase().includes(q) ||
      d.nameEn.toLowerCase().includes(q) ||
      d.code.toLowerCase().includes(q)
    )
  }, [destinations, searchQuery])

  // 當前選取的國家資訊
  const currentDestMeta = useMemo(() => {
    return destinations.find(d => d.code === selectedCountry) || destinations[0]
  }, [destinations, selectedCountry])

  // 依照方案類型與天數篩選當前方案
  const filteredPlans = useMemo(() => {
    return plans.filter(p => {
      if (planTypeFilter !== 'all' && p.planType !== planTypeFilter) return false
      if (dayFilter !== 'all' && p.day !== dayFilter) return false
      return true
    })
  }, [plans, planTypeFilter, dayFilter])

  // 提取可用天數清單
  const availableDays = useMemo(() => {
    const daysSet = new Set<number>()
    plans.forEach(p => daysSet.add(p.day))
    return Array.from(daysSet).sort((a, b) => a - b)
  }, [plans])

  // 執行結帳下單
  async function handleCheckout(e: React.FormEvent) {
    e.preventDefault()
    if (!checkoutPlan) return
    if (!customerEmail || !customerEmail.includes('@')) {
      setErrorMessage('請填寫正確的電子信箱，以接收 eSIM QR Code')
      return
    }

    setSubmitting(true)
    setErrorMessage('')

    try {
      const res = await fetch('/api/esim/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          channel_dataplan_id: checkoutPlan.channel_dataplan_id,
          customer_email: customerEmail,
          customer_name: customerName,
          customer_phone: customerPhone,
          quantity,
          payment_method: paymentMethod,
          return_url: window.location.href,
        }),
      })

      const data = await res.json()
      if (!res.ok || !data.success) {
        throw new Error(data.error || '結帳失敗，請稍後再試')
      }

      // 如果是綠界 ECPay，動態建立表單並自動 POST 跳轉綠界金流收銀台
      if (data.payment_method === 'ecpay' && data.action && data.params) {
        const form = document.createElement('form')
        form.method = 'POST'
        form.action = data.action
        Object.entries(data.params).forEach(([key, val]) => {
          const input = document.createElement('input')
          input.type = 'hidden'
          input.name = key
          input.value = String(val)
          form.appendChild(input)
        })
        document.body.appendChild(form)
        form.submit()
        return
      }

      // 測試模式或直接發卡成功：前往訂單詳情頁
      if (data.redirect_url) {
        window.location.href = data.redirect_url
      }
    } catch (err: any) {
      setErrorMessage(err.message || '連線異常，請稍後再試')
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-16 pb-24">
      {/* ── 1. HERO BANNER 區塊 ────────────────────────────────────── */}
      <section className="relative overflow-hidden bg-gradient-to-b from-blue-900 via-indigo-950 to-slate-900 text-white pt-12 pb-20 px-4 sm:px-6">
        {/* 背景裝飾光暈 */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-7xl h-96 bg-blue-500/10 blur-3xl pointer-events-none rounded-full" />
        <div className="absolute -top-24 right-10 w-80 h-80 bg-indigo-500/15 blur-3xl pointer-events-none rounded-full" />

        <div className="relative max-w-5xl mx-auto text-center space-y-6">
          {/* 特色 Badge */}
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/10 backdrop-blur-md border border-white/15 text-xs sm:text-sm font-medium text-sky-200 shadow-inner">
            <Sparkles className="w-4 h-4 text-amber-300 animate-pulse" />
            <span>2026 全球出國上網新革命・免換實體卡</span>
          </div>

          {/* 大標題 */}
          <h1 className="text-3xl sm:text-5xl md:text-6xl font-black tracking-tight leading-tight">
            出國旅遊上網，<br className="sm:hidden" />
            <span className="bg-gradient-to-r from-sky-400 via-blue-300 to-indigo-200 bg-clip-text text-transparent">
              掃描 QR Code 立即開通！
            </span>
          </h1>

          {/* 副標題 */}
          <p className="max-w-2xl mx-auto text-slate-300 text-sm sm:text-lg leading-relaxed">
            覆蓋全球 186+ 國家，日本、韓國、泰國、中港澳、歐洲 5G 原生高速。下單 1 秒出卡，保留原門號通話，免排隊取機，出發前 3 分鐘輕鬆搞定！
          </p>

          {/* 搜尋列 */}
          <div className="max-w-xl mx-auto pt-2">
            <div className="relative flex items-center bg-white rounded-2xl shadow-2xl p-1.5 focus-within:ring-4 focus-within:ring-sky-400/40 transition-all">
              <Search className="w-5 h-5 text-slate-400 ml-3 shrink-0" />
              <input
                type="text"
                placeholder="搜尋出國目的地（例：日本、韓國、泰國、歐洲）..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full px-3 py-2.5 text-slate-800 text-sm sm:text-base outline-none bg-transparent placeholder:text-slate-400 font-medium"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="p-1 hover:bg-slate-100 rounded-full text-slate-400 mr-2"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          {/* 4 大核心保證 Chips */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 max-w-3xl mx-auto pt-4 text-xs sm:text-sm">
            <div className="flex items-center justify-center gap-2 bg-white/5 border border-white/10 rounded-xl py-2.5 px-3">
              <Zap className="w-4 h-4 text-amber-400" />
              <span>下單即時出卡</span>
            </div>
            <div className="flex items-center justify-center gap-2 bg-white/5 border border-white/10 rounded-xl py-2.5 px-3">
              <Wifi className="w-4 h-4 text-sky-400" />
              <span>全球 5G 原生線路</span>
            </div>
            <div className="flex items-center justify-center gap-2 bg-white/5 border border-white/10 rounded-xl py-2.5 px-3">
              <Smartphone className="w-4 h-4 text-emerald-400" />
              <span>保留原 SIM 卡通話</span>
            </div>
            <div className="flex items-center justify-center gap-2 bg-white/5 border border-white/10 rounded-xl py-2.5 px-3">
              <ShieldCheck className="w-4 h-4 text-indigo-300" />
              <span>連線保證與退款退換</span>
            </div>
          </div>
        </div>
      </section>

      {/* ── 2. 熱門目的地快捷列 ────────────────────────────────────── */}
      <section id="destinations" className="max-w-7xl mx-auto px-4 sm:px-6 -mt-8">
        <div className="bg-white rounded-2xl shadow-xl border border-slate-200/80 p-4 sm:p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base sm:text-lg font-bold text-slate-900 flex items-center gap-2">
              <Globe className="w-5 h-5 text-blue-600" />
              <span>選擇出國目的地</span>
            </h2>
            <span className="text-xs text-slate-500 font-medium">共 {destinations.length} 個國家/地區</span>
          </div>

          {/* 橫向目的地膠囊按鈕流 */}
          <div className="flex gap-2.5 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-slate-200">
            {filteredDestinations.slice(0, 16).map(dest => {
              const isSelected = selectedCountry === dest.code
              return (
                <button
                  key={dest.code}
                  onClick={() => setSelectedCountry(dest.code)}
                  className={`flex items-center gap-2 px-3.5 py-2.5 rounded-xl border text-sm font-semibold shrink-0 transition-all ${
                    isSelected
                      ? 'bg-blue-600 text-white border-blue-600 shadow-md shadow-blue-500/25 scale-102'
                      : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100 hover:border-slate-300'
                  }`}
                >
                  <span className="text-lg">{dest.flag}</span>
                  <span>{dest.name}</span>
                  <span className={`text-xs px-1.5 py-0.5 rounded-md ${
                    isSelected ? 'bg-white/20 text-white' : 'bg-slate-200/70 text-slate-600'
                  }`}>
                    NT${dest.minPriceTwd}起
                  </span>
                </button>
              )
            })}
          </div>
        </div>
      </section>

      {/* ── 3. 方案列表與篩選主區塊 ────────────────────────────────── */}
      <section id="plans" className="max-w-7xl mx-auto px-4 sm:px-6">
        {/* 目的地資訊 Banner */}
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-100 rounded-2xl p-5 mb-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <span className="text-4xl sm:text-5xl">{currentDestMeta?.flag || '🌐'}</span>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-xl sm:text-2xl font-black text-slate-900">{currentDestMeta?.name || selectedCountry} eSIM</h3>
                <span className="text-xs bg-blue-600 text-white font-bold px-2 py-0.5 rounded-full">
                  {currentDestMeta?.nameEn}
                </span>
              </div>
              <p className="text-xs sm:text-sm text-slate-600 mt-1">
                {currentDestMeta?.description || '高品質出國漫遊與原生線路，下單即時自動發卡'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 self-end md:self-auto">
            <button
              onClick={() => fetchPlans(selectedCountry)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 bg-white rounded-lg border border-slate-200 shadow-xs hover:bg-slate-50 transition-colors"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span>更新資費</span>
            </button>
          </div>
        </div>

        {/* 方案類型與天數篩選 */}
        <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
          {/* 方案類型 Tab */}
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200">
            <button
              onClick={() => setPlanTypeFilter('all')}
              className={`px-3 py-1.5 text-xs sm:text-sm font-semibold rounded-lg transition-all ${
                planTypeFilter === 'all'
                  ? 'bg-white text-blue-600 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              全部方案
            </button>
            <button
              onClick={() => setPlanTypeFilter('daily')}
              className={`px-3 py-1.5 text-xs sm:text-sm font-semibold rounded-lg transition-all ${
                planTypeFilter === 'daily'
                  ? 'bg-white text-blue-600 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              🔥 每日高速型
            </button>
            <button
              onClick={() => setPlanTypeFilter('total')}
              className={`px-3 py-1.5 text-xs sm:text-sm font-semibold rounded-lg transition-all ${
                planTypeFilter === 'total'
                  ? 'bg-white text-blue-600 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              📦 總量型
            </button>
            <button
              onClick={() => setPlanTypeFilter('unlimited')}
              className={`px-3 py-1.5 text-xs sm:text-sm font-semibold rounded-lg transition-all ${
                planTypeFilter === 'unlimited'
                  ? 'bg-white text-blue-600 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              ♾️ 吃到飽
            </button>
          </div>

          {/* 天數下拉或快捷鈕 */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-500">出國天數：</span>
            <div className="flex items-center gap-1 overflow-x-auto max-w-xs sm:max-w-md pb-1">
              <button
                onClick={() => setDayFilter('all')}
                className={`px-2.5 py-1 text-xs font-medium rounded-md border ${
                  dayFilter === 'all'
                    ? 'bg-slate-800 text-white border-slate-800'
                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                }`}
              >
                不限
              </button>
              {availableDays.slice(0, 8).map(d => (
                <button
                  key={d}
                  onClick={() => setDayFilter(d)}
                  className={`px-2.5 py-1 text-xs font-medium rounded-md border shrink-0 ${
                    dayFilter === d
                      ? 'bg-slate-800 text-white border-slate-800'
                      : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  {d} 天
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* 方案卡片清單 */}
        {loading ? (
          <div className="py-20 text-center space-y-3">
            <div className="w-10 h-10 border-3 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-sm text-slate-500 font-medium">正在載入最新出國資費...</p>
          </div>
        ) : filteredPlans.length === 0 ? (
          <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-12 text-center space-y-3">
            <AlertCircle className="w-10 h-10 text-amber-500 mx-auto" />
            <h4 className="text-base font-bold text-slate-800">未找到符合條件的資費方案</h4>
            <p className="text-xs text-slate-500">建議切換其他天數或方案類型，或選擇其他國家目的地。</p>
            <button
              onClick={() => { setPlanTypeFilter('all'); setDayFilter('all'); }}
              className="px-4 py-2 text-xs font-semibold bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors"
            >
              清除篩選條件
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredPlans.map(plan => {
              const isHot = plan.planType === 'daily' && (plan.dataTierLabel.includes('1GB') || plan.dataTierLabel.includes('2GB'))
              return (
                <div
                  key={plan.channel_dataplan_id}
                  className="bg-white rounded-2xl border border-slate-200 hover:border-blue-300 p-5 shadow-xs hover:shadow-lg transition-all flex flex-col justify-between group"
                >
                  {/* 卡片頂部 */}
                  <div>
                    <div className="flex items-start justify-between gap-2 mb-3">
                      <div>
                        <div className="flex items-center gap-1.5 mb-1">
                          <span className="text-xl">{plan.flagEmoji}</span>
                          <span className="font-bold text-slate-900 text-base">{plan.primaryCountryName}</span>
                          <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-slate-100 text-slate-700">
                            {plan.day} 天
                          </span>
                        </div>
                        <h4 className="font-bold text-slate-800 text-sm group-hover:text-blue-600 transition-colors">
                          {plan.dataTierLabel}
                        </h4>
                      </div>
                      {isHot && (
                        <span className="bg-amber-50 text-amber-700 text-[11px] font-bold px-2 py-0.5 rounded-full border border-amber-200">
                          人氣首選
                        </span>
                      )}
                    </div>

                    {/* 方案規格細節 */}
                    <div className="space-y-2 text-xs text-slate-600 bg-slate-50 p-3 rounded-xl mb-4">
                      <div className="flex items-center justify-between">
                        <span className="text-slate-400">合作電信商</span>
                        <span className="font-medium text-slate-700 text-right truncate max-w-[180px]">
                          {plan.networks.replace(/\[.*?\]/g, '').replace(/\|/g, ', ').slice(0, 24) || '優質當地原生網路'}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-slate-400">網路頻寬</span>
                        <span className="font-medium text-blue-600">4G LTE / 5G 高速</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-slate-400">降速/斷線規則</span>
                        <span className="font-medium text-slate-700">
                          {plan.rule_desc.includes('unlimited') ? '用畢輕速吃到飽不斷線' : '用畢停止上網'}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-slate-400">開通方式</span>
                        <span className="font-medium text-emerald-600">抵達落地開啟漫遊即開通</span>
                      </div>
                    </div>
                  </div>

                  {/* 價格與下單按鈕 */}
                  <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-3">
                    <div>
                      <span className="text-[11px] text-slate-400 block">特惠含稅價</span>
                      <div className="flex items-baseline gap-1">
                        <span className="text-xs text-slate-500 font-bold">NT$</span>
                        <span className="text-2xl font-black text-slate-900 tracking-tight">
                          {plan.retailPriceTwd}
                        </span>
                      </div>
                    </div>
                    <button
                      onClick={() => {
                        setCheckoutPlan(plan)
                        setQuantity(1)
                        setErrorMessage('')
                      }}
                      className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs sm:text-sm shadow-md shadow-blue-500/20 active:scale-95 transition-all cursor-pointer"
                    >
                      <ShoppingCart className="w-4 h-4" />
                      <span>立即購買</span>
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </section>

      {/* ── 4. 適用機型快速檢測工具 ─────────────────────────────── */}
      <section id="compatibility" className="max-w-5xl mx-auto px-4 sm:px-6">
        <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-10 shadow-lg relative overflow-hidden">
          <div className="max-w-2xl mb-8">
            <span className="text-xs font-bold text-blue-600 uppercase tracking-wider">相容性檢測</span>
            <h3 className="text-2xl sm:text-3xl font-black text-slate-900 mt-1">
              我的手機可以使用 eSIM 嗎？
            </h3>
            <p className="text-slate-600 text-sm mt-2">
              只要手機出廠有內建 eSIM 晶片即可免換卡出國上網。最快檢測方式：拿起手機開啟電話撥號，輸入 <code className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded font-mono font-bold">*#06#</code>，畫面若有顯示 <strong>「EID」</strong>，即代表支援 eSIM！
            </p>
          </div>

          {/* 品牌選單 */}
          <div className="flex items-center gap-2 border-b border-slate-200 pb-3 mb-6">
            <button
              onClick={() => setDeviceBrand('apple')}
              className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all ${
                deviceBrand === 'apple' ? 'bg-slate-900 text-white shadow-xs' : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              Apple iPhone
            </button>
            <button
              onClick={() => setDeviceBrand('samsung')}
              className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all ${
                deviceBrand === 'samsung' ? 'bg-slate-900 text-white shadow-xs' : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              Samsung 三星
            </button>
            <button
              onClick={() => setDeviceBrand('google')}
              className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all ${
                deviceBrand === 'google' ? 'bg-slate-900 text-white shadow-xs' : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              Google Pixel
            </button>
            <button
              onClick={() => setDeviceBrand('other')}
              className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all ${
                deviceBrand === 'other' ? 'bg-slate-900 text-white shadow-xs' : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              iPad / 其他裝置
            </button>
          </div>

          {/* 支援機型內容 */}
          <div className="bg-slate-50 rounded-2xl p-5 border border-slate-200/80 text-sm">
            {deviceBrand === 'apple' && (
              <div className="space-y-3">
                <p className="font-bold text-slate-800">✅ 支援之 iPhone 機型（台灣/國際版）：</p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs text-slate-700">
                  <span>• iPhone 16 / 16 Plus / Pro / Max</span>
                  <span>• iPhone 15 / 15 Plus / Pro / Max</span>
                  <span>• iPhone 14 / 14 Plus / Pro / Max</span>
                  <span>• iPhone 13 / 13 mini / Pro / Max</span>
                  <span>• iPhone 12 / 12 mini / Pro / Max</span>
                  <span>• iPhone 11 / 11 Pro / Max</span>
                  <span>• iPhone XS / XS Max / XR</span>
                  <span>• iPhone SE 2 (2020) / SE 3 (2022)</span>
                </div>
                <div className="text-xs text-amber-700 bg-amber-50 p-2.5 rounded-lg border border-amber-200 mt-2">
                  ⚠️ 注意：中港澳版（中國/香港/澳門出廠）之實體雙實體卡槽 iPhone（如港版 11/12/13/14/15/16 Pro Max）部分不支援 eSIM。請務必先撥打 <code>*#06#</code> 確認是否有「EID」。
                </div>
              </div>
            )}

            {deviceBrand === 'samsung' && (
              <div className="space-y-3">
                <p className="font-bold text-slate-800">✅ 支援之 Samsung 機型：</p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs text-slate-700">
                  <span>• Galaxy S25 / S25+ / S25 Ultra</span>
                  <span>• Galaxy S24 / S24+ / S24 Ultra</span>
                  <span>• Galaxy S23 / S23+ / S23 Ultra</span>
                  <span>• Galaxy S22 / S22+ / S22 Ultra</span>
                  <span>• Galaxy S21 / S21+ / S21 Ultra</span>
                  <span>• Galaxy S20 系列 (特定版本)</span>
                  <span>• Galaxy Z Fold 2 / 3 / 4 / 5 / 6</span>
                  <span>• Galaxy Z Flip 3 / 4 / 5 / 6</span>
                </div>
              </div>
            )}

            {deviceBrand === 'google' && (
              <div className="space-y-3">
                <p className="font-bold text-slate-800">✅ 支援之 Google Pixel 機型：</p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs text-slate-700">
                  <span>• Pixel 9 / 9 Pro / 9 Pro XL / Fold</span>
                  <span>• Pixel 8 / 8 Pro / 8a</span>
                  <span>• Pixel 7 / 7 Pro / 7a</span>
                  <span>• Pixel 6 / 6 Pro / 6a</span>
                  <span>• Pixel 5 / 5a</span>
                  <span>• Pixel 4 / 4 XL / 4a</span>
                </div>
              </div>
            )}

            {deviceBrand === 'other' && (
              <div className="space-y-3">
                <p className="font-bold text-slate-800">✅ iPad 與其他品牌裝置：</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-slate-700">
                  <span>• iPad Pro 11 吋 (各代 Wi-Fi + 行動網路版)</span>
                  <span>• iPad Pro 12.9 吋 (第 3 代以後行動網路版)</span>
                  <span>• iPad Air (第 3 代以後行動網路版)</span>
                  <span>• iPad mini (第 5 代以後行動網路版)</span>
                  <span>• Xiaomi 13 / 14 系列 (國際版)</span>
                  <span>• Sony Xperia 1 IV / 1 V / 5 IV / 10 IV</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ── 5. 簡易 3 步驟安裝教學 ──────────────────────────────── */}
      <section id="setup-guide" className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="text-center max-w-2xl mx-auto mb-12 space-y-2">
          <span className="text-xs font-bold text-blue-600 uppercase tracking-wider">新手入門教學</span>
          <h3 className="text-2xl sm:text-3xl font-black text-slate-900">
            超簡單 3 步驟，下機立刻暢遊
          </h3>
          <p className="text-slate-600 text-sm">
            免帶退卡針、免保管小小的實體 SIM 卡，5 分鐘在手機設定內直接完成安裝！
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-4 shadow-xs">
            <div className="w-12 h-12 rounded-2xl bg-blue-100 text-blue-600 flex items-center justify-center font-black text-lg">
              1
            </div>
            <h4 className="text-lg font-bold text-slate-900">出發前掃描安裝</h4>
            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
              在台灣家中或機場連接 Wi-Fi，打開手機「設定」→「行動服務」→「加入 eSIM」，以相機掃描訂單 Email 的 QR Code 即可加入。
            </p>
            <div className="text-[11px] text-slate-400 bg-slate-50 p-2 rounded-lg">
              💡 方案標籤可自訂命名為「日本旅遊」或「出國上網」
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-4 shadow-xs">
            <div className="w-12 h-12 rounded-2xl bg-indigo-100 text-indigo-600 flex items-center justify-center font-black text-lg">
              2
            </div>
            <h4 className="text-lg font-bold text-slate-900">保留原門號接聽</h4>
            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
              您的台灣主要門號依然可以正常接收銀行信用卡刷卡簡訊驗證碼 (OTP)；行動數據設定切換至此 eSIM 即可。
            </p>
            <div className="text-[11px] text-slate-400 bg-slate-50 p-2 rounded-lg">
              💡 台灣實體卡請關閉「數據漫遊」，避免產生漫遊費用
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-4 shadow-xs">
            <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-600 flex items-center justify-center font-black text-lg">
              3
            </div>
            <h4 className="text-lg font-bold text-slate-900">落地開啟數據漫遊</h4>
            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
              班機抵達目的地機場後，關閉飛航模式，進入手機設定開啟此 eSIM 的「數據漫遊」，系統會在 1-2 分鐘內自動連接當地頂級電信商！
            </p>
            <div className="text-[11px] text-slate-400 bg-slate-50 p-2 rounded-lg">
              💡 若無法連線，將飛航模式開關一次即可重抓基地台訊號
            </div>
          </div>
        </div>
      </section>

      {/* ── 6. 常見問題 FAQ ────────────────────────────────────── */}
      <section id="faq" className="max-w-4xl mx-auto px-4 sm:px-6">
        <div className="text-center max-w-2xl mx-auto mb-10 space-y-2">
          <span className="text-xs font-bold text-blue-600 uppercase tracking-wider">常見問題解答</span>
          <h3 className="text-2xl sm:text-3xl font-black text-slate-900">
            旅客常見問題與解答
          </h3>
        </div>

        <div className="space-y-4 text-sm">
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
            <h4 className="font-bold text-slate-900 mb-2 flex items-center gap-2">
              <HelpCircle className="w-4 h-4 text-blue-600" />
              下單後多久會收到 eSIM QR Code？
            </h4>
            <p className="text-slate-600 text-xs sm:text-sm leading-relaxed">
              本商城已與電信機房全自動串接。完成付款後，瀏覽器頁面會<strong>「立即顯示」</strong>QR Code 與啟用碼，同時系統亦會發送含有憑證的確認信至您的 Email。您也可以隨時至本站「查詢訂單」輸入 Email 檢視。
            </p>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
            <h4 className="font-bold text-slate-900 mb-2 flex items-center gap-2">
              <HelpCircle className="w-4 h-4 text-blue-600" />
              可以開啟熱點分享給同行家人或筆電嗎？
            </h4>
            <p className="text-slate-600 text-xs sm:text-sm leading-relaxed">
              是的，本商城販售之大部分方案皆支援個人熱點分享功能（少數專用無限型依各國電信公平原則 FUP 限制）。建議依實際同行人數選擇每日 2GB~3GB 或總量型方案以獲得最佳上網速度。
            </p>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
            <h4 className="font-bold text-slate-900 mb-2 flex items-center gap-2">
              <HelpCircle className="w-4 h-4 text-blue-600" />
              天數是如何計算的？
            </h4>
            <p className="text-slate-600 text-xs sm:text-sm leading-relaxed">
              天數計算是從您<strong>「抵達目的地首次連接上當地基地台」</strong>那一刻開始計算，在台灣安裝時不會扣除天數！每日型方案多以自然日或 24 小時制計算（依方案規格標示）。
            </p>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
            <h4 className="font-bold text-slate-900 mb-2 flex items-center gap-2">
              <HelpCircle className="w-4 h-4 text-blue-600" />
              只有一台手機，無法掃描自己螢幕上的 QR Code 怎麼辦？
            </h4>
            <p className="text-slate-600 text-xs sm:text-sm leading-relaxed">
              您可以直接點擊訂單頁上的<strong>「複製啟用碼」</strong>（SM-DP+ 地址與啟用碼代碼），在加入 eSIM 畫面點選「手動輸入詳細資訊」，將代碼貼上即可立即開通，完全不需第二台螢幕掃描！
            </p>
          </div>
        </div>
      </section>

      {/* ── 7. 結帳購買彈窗 (Checkout Modal) ─────────────────────── */}
      {mounted && checkoutPlan && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 sm:p-6 bg-slate-900/70 backdrop-blur-sm">
          {/* 點擊半透明背景關閉彈窗 */}
          <div
            className="absolute inset-0 cursor-pointer"
            onClick={() => setCheckoutPlan(null)}
          />

          <div className="relative z-10 bg-white rounded-3xl max-w-lg w-full p-6 sm:p-8 shadow-2xl border border-slate-200 space-y-6 max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div>
                <span className="text-xs font-bold text-blue-600">下單訂購 eSIM</span>
                <h3 className="text-xl font-black text-slate-900 flex items-center gap-2">
                  <span>{checkoutPlan.flagEmoji}</span>
                  <span>{checkoutPlan.primaryCountryName} eSIM</span>
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setCheckoutPlan(null)}
                className="p-2 hover:bg-slate-100 rounded-full text-slate-400 cursor-pointer transition-colors"
                title="關閉"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* 方案規格摘要 */}
            <div className="bg-slate-50 rounded-2xl p-4 space-y-2 text-xs sm:text-sm border border-slate-200/80">
              <div className="flex justify-between">
                <span className="text-slate-500">資費規格</span>
                <span className="font-bold text-slate-900">{checkoutPlan.dataTierLabel}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">有效天數</span>
                <span className="font-bold text-slate-900">{checkoutPlan.day} 天</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">單價</span>
                <span className="font-bold text-slate-900">NT$ {checkoutPlan.retailPriceTwd}</span>
              </div>
            </div>

            {/* 表單 */}
            <form onSubmit={handleCheckout} className="space-y-4">
              {/* 數量選擇 */}
              <div className="flex items-center justify-between">
                <label className="text-xs sm:text-sm font-semibold text-slate-700">購買張數</label>
                <div className="flex items-center gap-3 bg-slate-100 p-1 rounded-xl">
                  <button
                    type="button"
                    onClick={() => setQuantity(q => Math.max(1, q - 1))}
                    className="w-7 h-7 rounded-lg bg-white shadow-xs font-bold text-slate-700 hover:bg-slate-200 flex items-center justify-center cursor-pointer"
                  >
                    -
                  </button>
                  <span className="font-bold text-sm text-slate-900 px-2">{quantity}</span>
                  <button
                    type="button"
                    onClick={() => setQuantity(q => Math.min(10, q + 1))}
                    className="w-7 h-7 rounded-lg bg-white shadow-xs font-bold text-slate-700 hover:bg-slate-200 flex items-center justify-center cursor-pointer"
                  >
                    +
                  </button>
                </div>
              </div>

              {/* 收件 Email */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  收件電子信箱 <span className="text-red-500">* (接收 QR Code 憑證)</span>
                </label>
                <input
                  type="email"
                  required
                  placeholder="name@example.com"
                  value={customerEmail}
                  onChange={e => setCustomerEmail(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:border-blue-600 focus:ring-2 focus:ring-blue-100 outline-none"
                />
              </div>

              {/* 姓名與電話 */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    聯絡人姓名 (選填)
                  </label>
                  <input
                    type="text"
                    placeholder="王大明"
                    value={customerName}
                    onChange={e => setCustomerName(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:border-blue-600 focus:ring-2 focus:ring-blue-100 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    手機號碼 (選填)
                  </label>
                  <input
                    type="tel"
                    placeholder="0912345678"
                    value={customerPhone}
                    onChange={e => setCustomerPhone(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:border-blue-600 focus:ring-2 focus:ring-blue-100 outline-none"
                  />
                </div>
              </div>

              {/* 付款方式選擇 */}
              <div className="space-y-2 pt-2">
                <label className="block text-xs font-semibold text-slate-700">付款方式</label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setPaymentMethod('ecpay')}
                    className={`p-3 rounded-xl border text-left flex flex-col justify-between transition-all cursor-pointer ${
                      paymentMethod === 'ecpay'
                        ? 'border-blue-600 bg-blue-50/50 ring-2 ring-blue-500/20'
                        : 'border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <CreditCard className="w-4 h-4 text-blue-600" />
                      {paymentMethod === 'ecpay' && <Check className="w-3.5 h-3.5 text-blue-600" />}
                    </div>
                    <div>
                      <div className="font-bold text-xs text-slate-900">綠界金流 ECPay</div>
                      <div className="text-[10px] text-slate-500">支援信用卡 / ATM / 超商代碼</div>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPaymentMethod('test_mode')}
                    className={`p-3 rounded-xl border text-left flex flex-col justify-between transition-all cursor-pointer ${
                      paymentMethod === 'test_mode'
                        ? 'border-indigo-600 bg-indigo-50/50 ring-2 ring-indigo-500/20'
                        : 'border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <Zap className="w-4 h-4 text-indigo-600" />
                      {paymentMethod === 'test_mode' && <Check className="w-3.5 h-3.5 text-indigo-600" />}
                    </div>
                    <div>
                      <div className="font-bold text-xs text-slate-900">快速發卡測試</div>
                      <div className="text-[10px] text-slate-500">免刷卡即時開卡驗證</div>
                    </div>
                  </button>
                </div>
              </div>

              {/* 錯誤提示 */}
              {errorMessage && (
                <div className="p-3 bg-red-50 text-red-700 text-xs rounded-xl flex items-center gap-2 border border-red-200">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{errorMessage}</span>
                </div>
              )}

              {/* 結帳總計與送出 */}
              <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
                <div>
                  <span className="text-xs text-slate-500">應付總額</span>
                  <div className="text-2xl font-black text-slate-900">
                    NT$ {checkoutPlan.retailPriceTwd * quantity}
                  </div>
                </div>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-6 py-3 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold text-sm shadow-lg shadow-blue-500/25 active:scale-95 transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {submitting ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>處理中...</span>
                    </>
                  ) : (
                    <>
                      <span>確認付款並開卡</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}
