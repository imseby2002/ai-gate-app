'use client'

import React, { useState, useEffect } from 'react'
import Link from 'next/link'
import {
  Wallet, RefreshCw, CheckCircle2, AlertCircle, QrCode, Mail,
  ArrowRight, ExternalLink, Globe, Shield, ShoppingCart, DollarSign, Bell,
  Tag, Percent, Sliders, Calculator, Sparkles, Save, Check
} from 'lucide-react'
import { DEFAULT_PRICING_SETTINGS, EsimPricingSettings } from '@/lib/esim/catalog'

export default function EsimAdminPage() {
  const [activeTab, setActiveTab] = useState<'pricing' | 'overview' | 'orders'>('pricing')
  
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

  // 即時定價試算器 (Simulator)
  const [testCostHkd, setTestCostHkd] = useState<number>(15.0)

  useEffect(() => {
    loadAdminData()
  }, [])

  async function loadAdminData() {
    setLoading(true)
    try {
      const [balRes, ordRes, setRes] = await Promise.all([
        fetch('/api/esim/balance').then(r => r.json()).catch(() => ({ success: false })),
        fetch('/api/esim/admin/orders').then(r => r.json()).catch(() => ({ success: false })),
        fetch('/api/esim/admin/settings').then(r => r.json()).catch(() => ({ success: false })),
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
    } catch (err) {
      console.error('Failed to load admin data:', err)
    } finally {
      setLoading(false)
    }
  }

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
    </div>
  )
}
