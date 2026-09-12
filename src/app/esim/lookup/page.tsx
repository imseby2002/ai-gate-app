'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import { Search, Mail, QrCode, ArrowRight, AlertCircle, RefreshCw, CheckCircle2 } from 'lucide-react'

interface EsimOrderSummary {
  order_no: string
  customer_email: string
  customer_name?: string
  country_name: string
  country_code: string
  data_amount: string
  day: number
  total_price_twd: number
  payment_status: string
  microesim_status: string
  created_at: string
}

export default function EsimLookupPage() {
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [orders, setOrders] = useState<EsimOrderSummary[]>([])
  const [hasSearched, setHasSearched] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    if (!query.trim()) return

    setLoading(true)
    setErrorMessage('')
    setHasSearched(true)

    try {
      const res = await fetch('/api/esim/lookup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: query.trim() }),
      })
      const data = await res.json()
      if (!res.ok || !data.success) {
        throw new Error(data.error || '查詢失敗')
      }
      setOrders(data.orders || [])
    } catch (err: any) {
      setErrorMessage(err.message || '連線異常，請稍後再試')
      setOrders([])
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-12 space-y-8">
      {/* 頁面標題 */}
      <div className="text-center max-w-xl mx-auto space-y-2">
        <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
          查詢我的 eSIM 訂單
        </h1>
        <p className="text-slate-600 text-sm">
          輸入您下單時填寫的<strong>電子信箱</strong>或<strong>訂單編號</strong>，即可快速找回您的 eSIM QR Code 與開通憑證。
        </p>
      </div>

      {/* 搜尋表單 */}
      <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 shadow-md max-w-2xl mx-auto">
        <form onSubmit={handleSearch} className="space-y-4">
          <div className="relative flex items-center bg-slate-50 rounded-2xl border border-slate-300 p-1.5 focus-within:ring-4 focus-within:ring-blue-100 focus-within:border-blue-600 transition-all">
            <Mail className="w-5 h-5 text-slate-400 ml-3 shrink-0" />
            <input
              type="text"
              required
              placeholder="請輸入電子信箱 (例：name@gmail.com) 或訂單號"
              value={query}
              onChange={e => setQuery(e.target.value)}
              className="w-full px-3 py-2 text-slate-900 text-sm sm:text-base outline-none bg-transparent placeholder:text-slate-400 font-medium"
            />
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs sm:text-sm shadow-md shadow-blue-500/20 active:scale-95 transition-all shrink-0 cursor-pointer disabled:opacity-50"
            >
              {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : '查詢訂單'}
            </button>
          </div>
          {errorMessage && (
            <div className="p-3 bg-red-50 text-red-700 text-xs rounded-xl flex items-center gap-2 border border-red-200">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}
        </form>
      </div>

      {/* 查詢結果 */}
      {hasSearched && (
        <div className="space-y-4 max-w-2xl mx-auto">
          <div className="flex items-center justify-between text-xs text-slate-500 px-1">
            <span>查詢關鍵字：「{query}」</span>
            <span>共找到 {orders.length} 筆紀錄</span>
          </div>

          {orders.length === 0 ? (
            <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-8 text-center space-y-2">
              <p className="text-sm font-semibold text-slate-700">查無相關 eSIM 訂單</p>
              <p className="text-xs text-slate-500">
                請確認您輸入的電子信箱是否與下單時填寫的一致，或檢查訂單號碼是否有誤。
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {orders.map(order => (
                <div
                  key={order.order_no}
                  className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs hover:border-blue-300 hover:shadow-md transition-all flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
                >
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-900 text-base">{order.country_name} eSIM</span>
                      <span className="text-xs bg-slate-100 text-slate-700 px-2 py-0.5 rounded-md font-semibold">
                        {order.data_amount} ({order.day} 天)
                      </span>
                    </div>
                    <div className="text-xs text-slate-500 space-x-3">
                      <span>訂單號：<span className="font-mono text-slate-700 font-medium">{order.order_no}</span></span>
                      <span>•</span>
                      <span>下單時間：{new Date(order.created_at).toLocaleDateString()}</span>
                    </div>
                    <div className="flex items-center gap-2 pt-1">
                      {order.microesim_status === 'delivered' ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                          <CheckCircle2 className="w-3 h-3" /> 已完成發卡
                        </span>
                      ) : (
                        <span className="text-[11px] font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                          處理中
                        </span>
                      )}
                      <span className="text-xs font-bold text-slate-800">NT$ {order.total_price_twd}</span>
                    </div>
                  </div>

                  <Link
                    href={`/esim/order/${order.order_no}`}
                    className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-600 font-bold text-xs shrink-0 transition-colors"
                  >
                    <QrCode className="w-4 h-4" />
                    <span>查看 QR Code 憑證</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
