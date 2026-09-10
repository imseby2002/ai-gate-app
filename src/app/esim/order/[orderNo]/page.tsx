'use client'

import React, { useState, useEffect } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import {
  CheckCircle2, QrCode, Copy, Check, Download, Mail, Smartphone,
  Wifi, HelpCircle, ShieldCheck, ArrowLeft, RefreshCw, AlertCircle, Share2
} from 'lucide-react'

interface EsimOrder {
  order_no: string
  customer_email: string
  customer_name?: string
  channel_dataplan_name: string
  country_code: string
  country_name: string
  day: number
  data_amount: string
  quantity: number
  total_price_twd: number
  payment_status: string
  microesim_status: string
  iccid?: string
  qr_code_url?: string
  activation_code?: string
  apn?: string
  operator_info?: string
  paid_at?: string
  created_at: string
  metadata?: Record<string, any>
}

export default function EsimOrderDetailPage() {
  const params = useParams()
  const orderNo = (params?.orderNo as string) || ''
  
  const [order, setOrder] = useState<EsimOrder | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [copiedKey, setCopiedKey] = useState<string | null>(null)
  
  // 補寄信件狀態
  const [resending, setResending] = useState(false)
  const [resendMessage, setResendMessage] = useState('')

  // 教學分頁
  const [guideTab, setGuideTab] = useState<'ios' | 'android'>('ios')

  useEffect(() => {
    if (orderNo) {
      loadOrder()
    }
  }, [orderNo])

  async function loadOrder() {
    try {
      setLoading(true)
      const res = await fetch(`/api/esim/order/${orderNo}`)
      const data = await res.json()
      if (!res.ok || !data.success) {
        throw new Error(data.error || '找不到此訂單')
      }
      setOrder(data.order)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  function handleCopy(text: string, key: string) {
    navigator.clipboard.writeText(text)
    setCopiedKey(key)
    setTimeout(() => setCopiedKey(null), 2000)
  }

  async function handleResendEmail() {
    if (!order) return
    setResending(true)
    setResendMessage('')
    try {
      const res = await fetch('/api/esim/resend-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ order_no: order.order_no, email: order.customer_email }),
      })
      const data = await res.json()
      if (data.success) {
        setResendMessage(`✅ 憑證已成功發送至 ${order.customer_email}`)
      } else {
        setResendMessage(`❌ ${data.error || '發送失敗'}`)
      }
    } catch {
      setResendMessage('❌ 系統異常，請直接截圖保存下方 QR Code')
    } finally {
      setResending(false)
    }
  }

  // 解析 SM-DP+ 地址與啟用碼
  const lpaParts = React.useMemo(() => {
    if (!order?.activation_code) return { smdp: '', matchId: '' }
    const code = order.activation_code
    // 格式通常為 LPA:1$smdp.address.com$matching-id
    const parts = code.split('$')
    if (parts.length >= 3) {
      return {
        smdp: parts[1],
        matchId: parts[2],
      }
    }
    return { smdp: code, matchId: '' }
  }, [order?.activation_code])

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-24 text-center space-y-3">
        <RefreshCw className="w-8 h-8 text-blue-600 animate-spin mx-auto" />
        <p className="text-sm font-medium text-slate-600">正在查詢您的 eSIM 開通憑證...</p>
      </div>
    )
  }

  if (error || !order) {
    return (
      <div className="max-w-xl mx-auto px-4 py-24 text-center space-y-4">
        <div className="w-12 h-12 rounded-full bg-red-100 text-red-600 flex items-center justify-center mx-auto">
          <AlertCircle className="w-6 h-6" />
        </div>
        <h2 className="text-xl font-bold text-slate-900">查詢失敗</h2>
        <p className="text-sm text-slate-600">{error || '找不到相符的訂單紀錄'}</p>
        <div className="pt-4 flex justify-center gap-3">
          <Link
            href="/esim"
            className="px-4 py-2 rounded-xl bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800"
          >
            返回商城首頁
          </Link>
          <Link
            href="/esim/lookup"
            className="px-4 py-2 rounded-xl bg-slate-100 text-slate-700 text-xs font-semibold hover:bg-slate-200"
          >
            以 Email 重新查詢
          </Link>
        </div>
      </div>
    )
  }

  const qrImageUrl = order.qr_code_url || (order.activation_code ? `https://api.qrserver.com/v1/create-qr-code/?size=350x350&data=${encodeURIComponent(order.activation_code)}` : '')

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-10 space-y-8">
      {/* 導航回商城 */}
      <div className="flex items-center justify-between">
        <Link
          href="/esim"
          className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-medium text-slate-500 hover:text-slate-900 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>返回商城選購其他目的地</span>
        </Link>
        <span className="text-xs text-slate-400 font-mono">訂單編號：{order.order_no}</span>
      </div>

      {/* 開通成功提示卡片 */}
      <div className="bg-gradient-to-r from-emerald-600 via-teal-600 to-sky-600 rounded-3xl p-6 sm:p-8 text-white shadow-xl relative overflow-hidden">
        <div className="relative z-10 space-y-3">
          <div className="inline-flex items-center gap-1.5 bg-white/20 backdrop-blur-md px-3 py-1 rounded-full text-xs font-semibold">
            <CheckCircle2 className="w-4 h-4 text-emerald-300" />
            <span>eSIM 發卡成功・立即可用</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight">
            {order.country_name} 出國上網憑證已備妥！
          </h1>
          <p className="text-xs sm:text-sm text-emerald-50 max-w-2xl leading-relaxed">
            感謝您的購買。請於出發前或抵達當地後，依照下方步驟安裝此 eSIM。安裝完成後請保留原 SIM 卡，抵達目的地再開啟漫遊即可暢快上網。
          </p>
        </div>
      </div>

      {/* 主憑證與 QR Code 區塊 */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-start">
        {/* 左側：QR Code 掃描卡片 */}
        <div className="md:col-span-5 bg-white rounded-3xl border border-slate-200 p-6 shadow-md text-center space-y-4">
          <div className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500">
            <QrCode className="w-4 h-4 text-blue-600" />
            <span>掃描安裝 QR Code</span>
          </div>

          <div className="p-4 bg-slate-50 rounded-2xl inline-block border border-slate-100 shadow-inner">
            {qrImageUrl ? (
              <img
                src={qrImageUrl}
                alt="eSIM QR Code"
                className="w-56 h-56 mx-auto rounded-xl shadow-xs"
              />
            ) : (
              <div className="w-56 h-56 flex items-center justify-center text-xs text-slate-400">
                憑證生成中...
              </div>
            )}
          </div>

          <p className="text-xs text-slate-500 leading-relaxed">
            建議以同行友人手機出示此 QR Code，或在平板/電腦上開啟本網址，再以您的出國手機掃描安裝。
          </p>

          <div className="pt-2 flex flex-col gap-2">
            <button
              onClick={() => window.print()}
              className="w-full py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors flex items-center justify-center gap-1.5"
            >
              <Download className="w-3.5 h-3.5" />
              <span>列印 / 存為 PDF 憑證</span>
            </button>
            <button
              onClick={handleResendEmail}
              disabled={resending}
              className="w-full py-2.5 rounded-xl bg-blue-50 text-blue-600 hover:bg-blue-100 text-xs font-bold transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50"
            >
              <Mail className="w-3.5 h-3.5" />
              <span>{resending ? '發送中...' : '重新寄送至 Email'}</span>
            </button>
            {resendMessage && (
              <p className="text-xs font-medium text-slate-600 mt-1">{resendMessage}</p>
            )}
          </div>
        </div>

        {/* 右側：方案規格與手動啟用碼 (適合單機安裝) */}
        <div className="md:col-span-7 space-y-6">
          {/* 手動輸入開通碼卡片 */}
          <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                <Smartphone className="w-4 h-4 text-indigo-600" />
                <span>只有一台手機？手動安裝免掃描</span>
              </h3>
              <span className="text-[11px] bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-full font-semibold">
                免第二螢幕
              </span>
            </div>
            <p className="text-xs text-slate-500 leading-relaxed">
              在手機「加入行動方案」畫面點選「手動輸入詳細資訊」，分別複製貼上下方內容：
            </p>

            {/* SM-DP+ 地址 */}
            {lpaParts.smdp && (
              <div className="space-y-1">
                <span className="text-[11px] font-semibold text-slate-500">SM-DP+ 地址 (伺服器地址)</span>
                <div className="flex items-center justify-between bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                  <span className="font-mono text-xs text-slate-800 truncate select-all">{lpaParts.smdp}</span>
                  <button
                    onClick={() => handleCopy(lpaParts.smdp, 'smdp')}
                    className="p-1.5 hover:bg-slate-200 rounded-lg text-slate-600 transition-colors shrink-0"
                    title="複製"
                  >
                    {copiedKey === 'smdp' ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            )}

            {/* 啟用碼 (Activation Code) */}
            {lpaParts.matchId && (
              <div className="space-y-1">
                <span className="text-[11px] font-semibold text-slate-500">啟用碼 (Matching ID)</span>
                <div className="flex items-center justify-between bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                  <span className="font-mono text-xs text-slate-800 truncate select-all">{lpaParts.matchId}</span>
                  <button
                    onClick={() => handleCopy(lpaParts.matchId, 'matchId')}
                    className="p-1.5 hover:bg-slate-200 rounded-lg text-slate-600 transition-colors shrink-0"
                    title="複製"
                  >
                    {copiedKey === 'matchId' ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            )}

            {/* 完整 LPA 字串 */}
            {order.activation_code && (
              <div className="space-y-1">
                <span className="text-[11px] font-semibold text-slate-500">完整 LPA 代碼字串</span>
                <div className="flex items-center justify-between bg-slate-900 p-2.5 rounded-xl text-sky-400">
                  <span className="font-mono text-xs truncate select-all">{order.activation_code}</span>
                  <button
                    onClick={() => handleCopy(order.activation_code!, 'lpa')}
                    className="p-1.5 hover:bg-slate-800 rounded-lg text-sky-300 transition-colors shrink-0"
                    title="複製完整字串"
                  >
                    {copiedKey === 'lpa' ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            )}

            {/* 快速一鍵安裝連結 (iOS & Android) */}
            {(order.metadata?.ios_esim_install_link || order.metadata?.android_esim_install_link) && (
              <div className="pt-2 flex flex-col sm:flex-row gap-2">
                {order.metadata.ios_esim_install_link && (
                  <a
                    href={order.metadata.ios_esim_install_link}
                    className="flex-1 text-center py-2.5 px-3 rounded-xl bg-slate-900 text-white font-semibold text-xs hover:bg-slate-800 transition-colors flex items-center justify-center gap-1.5 shadow-xs"
                  >
                    <span>🍎 iPhone 一鍵加入 eSIM</span>
                  </a>
                )}
                {order.metadata.android_esim_install_link && (
                  <a
                    href={order.metadata.android_esim_install_link}
                    className="flex-1 text-center py-2.5 px-3 rounded-xl bg-emerald-600 text-white font-semibold text-xs hover:bg-emerald-700 transition-colors flex items-center justify-center gap-1.5 shadow-xs"
                  >
                    <span>🤖 Android 一鍵安裝</span>
                  </a>
                )}
              </div>
            )}
          </div>

          {/* 方案詳細資訊清單 */}
          <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-xs space-y-3 text-xs sm:text-sm">
            <h4 className="font-bold text-slate-900 text-sm mb-2">📋 訂單與資費規格</h4>
            
            <div className="flex justify-between py-2 border-b border-slate-100">
              <span className="text-slate-500">目的地</span>
              <span className="font-semibold text-slate-900">{order.country_name} ({order.country_code})</span>
            </div>

            <div className="flex justify-between py-2 border-b border-slate-100">
              <span className="text-slate-500">資費方案</span>
              <span className="font-semibold text-slate-900">{order.data_amount} ({order.day} 天)</span>
            </div>

            <div className="flex justify-between py-2 border-b border-slate-100">
              <span className="text-slate-500">ICCID 識別碼</span>
              <span className="font-mono font-semibold text-slate-900">{order.iccid || '開通後回傳'}</span>
            </div>

            <div className="flex justify-between py-2 border-b border-slate-100">
              <span className="text-slate-500">APN 設定</span>
              <span className="font-mono font-semibold text-slate-900">{order.apn || '自動偵測'}</span>
            </div>

            <div className="flex justify-between py-2 border-b border-slate-100">
              <span className="text-slate-500">合作電信</span>
              <span className="font-semibold text-slate-900 text-right truncate max-w-[200px]">
                {order.operator_info || '當地優質原生電信商'}
              </span>
            </div>

            <div className="flex justify-between py-2 border-b border-slate-100">
              <span className="text-slate-500">結帳金額</span>
              <span className="font-bold text-slate-900">NT$ {order.total_price_twd} (已完成付款)</span>
            </div>

            <div className="flex justify-between py-2">
              <span className="text-slate-500">收件電子信箱</span>
              <span className="font-semibold text-slate-900">{order.customer_email}</span>
            </div>
          </div>
        </div>
      </div>

      {/* 下方安裝與開通指南 (Tabs) */}
      <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 shadow-xs space-y-6">
        <div className="flex items-center justify-between border-b border-slate-200 pb-4">
          <div className="flex items-center gap-2">
            <Wifi className="w-5 h-5 text-blue-600" />
            <h3 className="font-bold text-slate-900 text-base sm:text-lg">手機安裝與開通詳細教學</h3>
          </div>
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
            <button
              onClick={() => setGuideTab('ios')}
              className={`px-3 py-1 text-xs font-bold rounded-lg transition-all ${
                guideTab === 'ios' ? 'bg-white text-blue-600 shadow-xs' : 'text-slate-600'
              }`}
            >
              Apple iPhone
            </button>
            <button
              onClick={() => setGuideTab('android')}
              className={`px-3 py-1 text-xs font-bold rounded-lg transition-all ${
                guideTab === 'android' ? 'bg-white text-blue-600 shadow-xs' : 'text-slate-600'
              }`}
            >
              Android (三星 / Pixel)
            </button>
          </div>
        </div>

        {guideTab === 'ios' ? (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 text-xs sm:text-sm text-slate-600">
            <div className="space-y-2 p-4 bg-slate-50 rounded-2xl">
              <div className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
                <span className="w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs">1</span>
                <span>出發前掃描安裝</span>
              </div>
              <p>連接 Wi-Fi 後，前往<strong>「設定」→「行動服務」→「加入 eSIM」</strong>，選擇<strong>「使用行動條碼」</strong>掃描上方 QR Code。</p>
            </div>
            <div className="space-y-2 p-4 bg-slate-50 rounded-2xl">
              <div className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
                <span className="w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs">2</span>
                <span>標籤與設定門號</span>
              </div>
              <p>將此 eSIM 方案標籤命名為「旅遊」。預設語音號碼保留為台灣主號碼，行動數據設定為「旅遊」。</p>
            </div>
            <div className="space-y-2 p-4 bg-slate-50 rounded-2xl">
              <div className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
                <span className="w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs">3</span>
                <span>落地開啟數據漫遊</span>
              </div>
              <p>抵達目的地後，進入「設定」→「行動服務」→ 點入「旅遊 eSIM」，開啟<strong>「數據漫遊」</strong>即可自動連線上網！</p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 text-xs sm:text-sm text-slate-600">
            <div className="space-y-2 p-4 bg-slate-50 rounded-2xl">
              <div className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
                <span className="w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs">1</span>
                <span>掃描新增 SIM 卡</span>
              </div>
              <p>前往<strong>「設定」→「連接 / 網路與網際網路」→「SIM 卡管理器」→「新增 eSIM」</strong>，掃描本頁的 QR Code。</p>
            </div>
            <div className="space-y-2 p-4 bg-slate-50 rounded-2xl">
              <div className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
                <span className="w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs">2</span>
                <span>切換數據網路</span>
              </div>
              <p>將主要上網數據設定切換為此 eSIM，保留實體卡槽門號為通話與接收驗證碼專用。</p>
            </div>
            <div className="space-y-2 p-4 bg-slate-50 rounded-2xl">
              <div className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
                <span className="w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs">3</span>
                <span>落地開啟漫遊</span>
              </div>
              <p>抵達目的地國家後，在該 eSIM 設定中開啟<strong>「數據漫遊」</strong>，等待 1-2 分鐘重啟即可享受高速網路。</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
