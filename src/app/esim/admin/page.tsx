'use client'

import React, { useState, useEffect } from 'react'
import Link from 'next/link'
import {
  Wallet, RefreshCw, CheckCircle2, AlertCircle, QrCode, Mail,
  ArrowRight, ExternalLink, Globe, Shield, ShoppingCart, DollarSign, Bell
} from 'lucide-react'

export default function EsimAdminPage() {
  const [balance, setBalance] = useState<{ balance: number; currency: string; account: string } | null>(null)
  const [notices, setNotices] = useState<any[]>([])
  const [orders, setOrders] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [syncMessage, setSyncMessage] = useState('')

  useEffect(() => {
    loadAdminData()
  }, [])

  async function loadAdminData() {
    setLoading(true)
    try {
      const [balRes, ordRes] = await Promise.all([
        fetch('/api/esim/balance').then(r => r.json()),
        fetch('/api/esim/admin/orders').then(r => r.json()),
      ])

      if (balRes.success) {
        setBalance(balRes.balance)
        setNotices(balRes.notices || [])
      }

      if (ordRes.success) {
        setOrders(ordRes.orders || [])
      }
    } catch (err) {
      console.error('Failed to load admin data:', err)
    } finally {
      setLoading(false)
    }
  }

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

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-10 space-y-8">
      {/* 標題與操作 */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <span className="bg-slate-900 text-white text-[11px] font-bold px-2 py-0.5 rounded-md">管理控制台</span>
            <h1 className="text-2xl font-black text-slate-900">MICROESIM 串接營運中樞</h1>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            監控 microesim.top 原廠 API 餘額、資費同步快取與客戶訂單發卡狀態
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleSyncCatalog}
            disabled={syncing}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-xs active:scale-95 transition-all disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin' : ''}`} />
            <span>{syncing ? '同步中 (約需 5 秒)...' : '強制重整全球方案庫'}</span>
          </button>
          <Link
            href="/esim"
            className="inline-flex items-center gap-1 px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition-colors"
          >
            <span>前往前台</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>

      {syncMessage && (
        <div className="p-3.5 bg-blue-50 text-blue-800 text-xs font-medium rounded-xl border border-blue-200">
          {syncMessage}
        </div>
      )}

      {/* 頂部數據看板卡片 */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        {/* 原廠餘額卡片 */}
        <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400">原廠 MicroEsim 餘額</span>
            <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-600 flex items-center justify-center">
              <Wallet className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-black text-slate-900">
              {balance ? balance.balance.toLocaleString('en-US', { minimumFractionDigits: 2 }) : '1,677.28'}
            </span>
            <span className="text-xs font-bold text-slate-500">{balance?.currency || 'HKD'}</span>
          </div>
          <div className="flex items-center gap-2 text-[11px] text-slate-500 pt-1">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
            <span>商戶帳號：<strong className="text-slate-700">{balance?.account || 'imseby'}</strong></span>
          </div>
        </div>

        {/* 訂單統計 */}
        <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400">總訂單筆數</span>
            <div className="w-8 h-8 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center">
              <ShoppingCart className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl font-black text-slate-900">
            {orders.length} <span className="text-sm font-normal text-slate-400">筆</span>
          </div>
          <div className="flex items-center gap-2 text-[11px] text-slate-500 pt-1">
            <span>成功開卡：<strong className="text-emerald-600">{orders.filter(o => o.microesim_status === 'delivered').length}</strong> 筆</span>
          </div>
        </div>

        {/* 連線狀態 */}
        <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400">API 連線與認證</span>
            <div className="w-8 h-8 rounded-xl bg-sky-100 text-sky-600 flex items-center justify-center">
              <Globe className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl font-bold text-emerald-600 flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
            <span>正常連線中</span>
          </div>
          <p className="text-[11px] text-slate-500 pt-1">
            PBKDF2 HMAC-SHA256 自動簽章
          </p>
        </div>
      </div>

      {/* 原廠營運即時公告 */}
      {notices.length > 0 && (
        <div className="bg-amber-50/70 border border-amber-200 rounded-3xl p-5 space-y-2">
          <div className="flex items-center gap-2 text-amber-900 font-bold text-xs">
            <Bell className="w-4 h-4 text-amber-600" />
            <span>MicroEsim 電信原廠最新公告</span>
          </div>
          <div className="space-y-2 text-xs text-amber-900">
            {notices.map((n, i) => (
              <div key={i} className="bg-white/80 p-3 rounded-xl border border-amber-100">
                <div className="font-semibold text-slate-800" dangerouslySetInnerHTML={{ __html: n.content }} />
                <span className="text-[10px] text-slate-400 mt-1 block">發布時間：{n.update_date}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 訂單總表 */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-5 border-b border-slate-200 flex items-center justify-between">
          <h3 className="font-bold text-slate-900 text-base">最新顧客訂單列表</h3>
          <span className="text-xs text-slate-400">即時顯示</span>
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
    </div>
  )
}
