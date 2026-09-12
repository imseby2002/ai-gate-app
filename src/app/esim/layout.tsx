import React from 'react'
import Link from 'next/link'
import { Globe, Wifi, Smartphone, Search, HelpCircle, ShieldCheck, Mail, CheckCircle2 } from 'lucide-react'

export const metadata = {
  title: 'imTourist 全球出國上網 eSIM 專賣店 | 186+ 國即買即用・免換卡高速 5G',
  description: '提供日本、韓國、泰國、中港澳、歐洲、美加、東南亞等全球 186 國出國上網 eSIM，下單即時發卡，掃描 QR Code 5 分鐘開通，支援 5G 原生高速與熱點分享。',
}

export default function EsimLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col selection:bg-blue-500 selection:text-white">
      {/* 頂部促銷與服務宣傳條 */}
      <div className="bg-gradient-to-r from-blue-700 via-indigo-600 to-sky-600 text-white text-xs sm:text-sm py-2 px-4">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="bg-white/20 px-2 py-0.5 rounded-full font-bold text-[11px] uppercase tracking-wider">即時發卡</span>
            <span>✈️ 全球 186 國出國上網 eSIM・下單秒速開通・免運費免換卡</span>
          </div>
          <div className="flex items-center gap-4 text-xs">
            <span className="hidden sm:inline-flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-300" /> 24/7 自動發卡
            </span>
            <span className="hidden sm:inline-flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5 text-sky-200" /> 連線品質保證
            </span>
            <Link href="/esim/lookup" className="underline hover:text-sky-200 font-medium">
              查詢我的 eSIM 訂單
            </Link>
          </div>
        </div>
      </div>

      {/* 主導航欄 */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur border-b border-slate-200 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          {/* Logo */}
          <Link href="/esim" className="flex items-center gap-2.5 group">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white shadow-md shadow-blue-500/20 group-hover:scale-105 transition-transform">
              <Wifi className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-1.5 font-black text-xl tracking-tight text-slate-900">
                <span>imTourist</span>
                <span className="text-blue-600">eSIM</span>
              </div>
              <p className="text-[10px] text-slate-500 leading-none font-medium">出國高速上網專賣店</p>
            </div>
          </Link>

          {/* 導航選單 */}
          <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-600">
            <Link href="/esim#destinations" className="hover:text-blue-600 transition-colors">
              熱門目的地
            </Link>
            <Link href="/esim#plans" className="hover:text-blue-600 transition-colors">
              資費方案
            </Link>
            <Link href="/esim#compatibility" className="hover:text-blue-600 transition-colors flex items-center gap-1">
              <Smartphone className="w-4 h-4 text-blue-500" /> 支援機型
            </Link>
            <Link href="/esim#setup-guide" className="hover:text-blue-600 transition-colors">
              安裝指南
            </Link>
            <Link href="/esim#faq" className="hover:text-blue-600 transition-colors">
              常見問題
            </Link>
          </nav>

          {/* 右側操作按鈕 */}
          <div className="flex items-center gap-3">
            <Link
              href="/esim/lookup"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs sm:text-sm font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
            >
              <Search className="w-3.5 h-3.5" />
              <span>查詢訂單</span>
            </Link>
            <Link
              href="/esim/admin"
              className="hidden lg:inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-slate-500 hover:text-slate-800 rounded-md hover:bg-slate-50 border border-slate-200 transition-colors"
              title="後台管理"
            >
              管理
            </Link>
          </div>
        </div>
      </header>

      {/* 主內容區 */}
      <main className="flex-1">
        {children}
      </main>

      {/* 底部 Footer */}
      <footer className="bg-slate-900 text-slate-400 text-sm border-t border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-12">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-12">
            <div className="space-y-3 md:col-span-2">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white font-bold">
                  <Wifi className="w-4 h-4" />
                </div>
                <span className="text-lg font-bold text-white tracking-tight">imTourist eSIM 全球出國上網</span>
              </div>
              <p className="text-slate-400 text-sm max-w-md leading-relaxed">
                專為台灣及全球旅客設計的出國上網 eSIM 專賣店。全自動 24 小時線上發卡，與全球頂級電信業者直連，支援日本 Docomo/Softbank、韓國 SKT、台灣中華電信、泰國 True 等原生高頻寬網路，免插卡、免排隊取機，落地即上網。
              </p>
              <div className="flex items-center gap-3 text-xs text-slate-400 pt-2">
                <span className="flex items-center gap-1">
                  <ShieldCheck className="w-4 h-4 text-emerald-400" /> SSL 256 位元加密交易
                </span>
                <span>•</span>
                <span>綠界 ECPay 履約保證</span>
              </div>
            </div>

            <div>
              <h4 className="text-white font-semibold mb-3 text-sm">熱門出國目的地</h4>
              <ul className="space-y-2 text-xs">
                <li><Link href="/esim?country=JP" className="hover:text-white transition-colors">🇯🇵 日本 eSIM (Docomo/SoftBank)</Link></li>
                <li><Link href="/esim?country=KR" className="hover:text-white transition-colors">🇰🇷 韓國 eSIM (SKT/KT 原生)</Link></li>
                <li><Link href="/esim?country=TH" className="hover:text-white transition-colors">🇹🇭 泰國 eSIM (TrueMove/AIS)</Link></li>
                <li><Link href="/esim?country=VN" className="hover:text-white transition-colors">🇻🇳 越南 eSIM (Vinaphone 5G)</Link></li>
                <li><Link href="/esim?country=EU" className="hover:text-white transition-colors">🇪🇺 歐洲 33 國通用 eSIM</Link></li>
                <li><Link href="/esim?country=US" className="hover:text-white transition-colors">🇺🇸 美國/加拿大 eSIM</Link></li>
              </ul>
            </div>

            <div>
              <h4 className="text-white font-semibold mb-3 text-sm">客戶服務與說明</h4>
              <ul className="space-y-2 text-xs">
                <li><Link href="/esim/lookup" className="hover:text-white transition-colors">查詢我的 eSIM QR Code</Link></li>
                <li><Link href="/esim#compatibility" className="hover:text-white transition-colors">我的手機支援 eSIM 嗎？</Link></li>
                <li><Link href="/esim#setup-guide" className="hover:text-white transition-colors">iOS / Android 安裝教學</Link></li>
                <li><Link href="/esim#faq" className="hover:text-white transition-colors">常見問題 FAQ</Link></li>
                <li className="pt-2 text-slate-300">
                  <span className="block font-medium">客服信箱：</span>
                  <span className="text-sky-400">service@im-tourist.com</span>
                </li>
              </ul>
            </div>
          </div>

          <div className="pt-8 border-t border-slate-800 text-xs flex flex-col sm:flex-row items-center justify-between gap-4 text-slate-400">
            <p>© 2026 imTourist. All rights reserved. 串接 MICROESIM.TOP 官方數據網路服務。</p>
            <div className="flex items-center gap-4">
              <Link href="/privacy" className="hover:text-slate-300">隱私權政策</Link>
              <Link href="/esim#faq" className="hover:text-slate-300">服務條款</Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}
