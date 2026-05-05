'use client'

import Link from 'next/link'
import {
  Headphones, MessageSquare, Bot, Database, Calculator,
  FlaskConical, ClipboardList, Zap, Shield, Globe,
  ArrowRight, CheckCircle2, Sparkles, PhoneCall,
} from 'lucide-react'

const PLATFORMS = [
  { name: 'LINE OA',          color: '#00B900', emoji: '💬' },
  { name: 'WhatsApp Business', color: '#25D366', emoji: '📱' },
  { name: 'WhatsApp 個人版',   color: '#128C7E', emoji: '📲' },
  { name: 'Telegram',         color: '#2AABEE', emoji: '✈️' },
  { name: 'Zalo OA',          color: '#0068FF', emoji: '🔵' },
  { name: 'WeChat',           color: '#07C160', emoji: '💚' },
]

const FEATURES = [
  {
    icon: Bot,
    color: 'from-violet-500 to-purple-600',
    bg: 'bg-violet-50',
    iconColor: 'text-violet-600',
    title: 'AI 雙模型架構',
    desc: 'Gemini Flash 快速意圖分類，高風險問題自動升級 Claude Sonnet 精確回覆，兼顧速度與品質。',
    points: ['即時意圖識別', '高風險自動升級', '多語言自動偵測'],
  },
  {
    icon: Database,
    color: 'from-blue-500 to-indigo-600',
    bg: 'bg-blue-50',
    iconColor: 'text-blue-600',
    title: '知識庫 & 資料來源',
    desc: '上傳 FAQ、產品說明、服務條款文件，AI 自動學習並整合 Google Sheets 即時資料。',
    points: ['PDF / Word / Excel 上傳', 'Google Sheets 即時串接', '自訂觸發關鍵字'],
  },
  {
    icon: Calculator,
    color: 'from-emerald-500 to-teal-600',
    bg: 'bg-emerald-50',
    iconColor: 'text-emerald-600',
    title: '定價計算機',
    desc: '設定行程/房型定價規則，AI 自動依人數、日期計算並直接告知客戶總價，無需人工介入。',
    points: ['彈性定價規則', 'AI 自動報價', '多方案並行'],
  },
  {
    icon: PhoneCall,
    color: 'from-orange-500 to-amber-600',
    bg: 'bg-orange-50',
    iconColor: 'text-orange-600',
    title: '預訂流程引導',
    desc: '設定預訂步驟（日期→人數→乘客資料→電話），AI 按順序逐步引導客戶完成預訂。',
    points: ['自訂預訂步驟', '逐步引導不跳關', '自動整理訂單資料'],
  },
  {
    icon: FlaskConical,
    color: 'from-pink-500 to-rose-600',
    bg: 'bg-pink-50',
    iconColor: 'text-pink-600',
    title: '即時對話測試',
    desc: '正式上線前在平台內直接測試對話效果，即時查看 AI 意圖判斷與回覆品質。',
    points: ['不需真實平台', '即時查看意圖分類', '風險等級顯示'],
  },
  {
    icon: ClipboardList,
    color: 'from-slate-500 to-gray-600',
    bg: 'bg-slate-50',
    iconColor: 'text-slate-600',
    title: '完整對話紀錄',
    desc: '所有客戶對話自動記錄，包含 AI 回覆、意圖分類、風險等級與回應延遲時間。',
    points: ['完整對話歷史', '意圖 & 風險標記', '延遲時間追蹤'],
  },
]

const STEPS = [
  { num: '01', title: '連結平台', desc: '填入 LINE / WhatsApp 等 API Key，複製 Webhook URL 到平台後台' },
  { num: '02', title: '上傳知識庫', desc: '上傳 FAQ 文件、設定定價規則、配置預訂流程步驟' },
  { num: '03', title: '測試對話', desc: '在測試模式中模擬客戶對話，確認 AI 回覆品質' },
  { num: '04', title: '正式上線', desc: '客戶發送訊息後，AI 自動即時回覆，超過閾值才轉人工' },
]

export default function CsHomePage() {
  return (
    <div className="min-h-full bg-gradient-to-b from-gray-50 to-white">

      {/* Hero */}
      <div className="px-6 py-12 max-w-5xl mx-auto text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 text-primary text-xs font-semibold mb-6">
          <Sparkles className="h-3.5 w-3.5" />
          AI 智能客服系統
        </div>
        <h1 className="text-4xl font-extrabold text-gray-900 mb-4 leading-tight">
          24 小時不間斷的
          <span className="bg-gradient-to-r from-primary to-violet-600 bg-clip-text text-transparent"> AI 客服</span>
        </h1>
        <p className="text-gray-500 text-lg max-w-2xl mx-auto mb-8 leading-relaxed">
          整合 LINE、WhatsApp、Telegram 等多平台，AI 自動分類意圖、引導預訂流程、即時報價，
          讓你的客服效率提升 10 倍。
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link href="/marketing-auto?module=cs"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-semibold text-white shadow-lg transition-all hover:shadow-xl hover:-translate-y-0.5"
            style={{ background: 'linear-gradient(135deg, var(--primary), color-mix(in oklch, var(--primary) 70%, violet))' }}>
            <Zap className="h-4 w-4" />
            進入客服系統設定
            <ArrowRight className="h-4 w-4" />
          </Link>
          <span className="text-xs text-gray-400 flex items-center gap-1">
            <Shield className="h-3.5 w-3.5" /> 免費，不限對話次數
          </span>
        </div>
      </div>

      {/* Platform badges */}
      <div className="px-6 pb-10 max-w-5xl mx-auto">
        <p className="text-center text-xs text-gray-400 font-medium uppercase tracking-wider mb-4">支援平台</p>
        <div className="flex flex-wrap justify-center gap-3">
          {PLATFORMS.map(p => (
            <div key={p.name}
              className="flex items-center gap-2 px-4 py-2 rounded-full border bg-white shadow-sm text-sm font-medium text-gray-700">
              <span>{p.emoji}</span>
              <span>{p.name}</span>
              <span className="w-2 h-2 rounded-full" style={{ background: p.color }} />
            </div>
          ))}
        </div>
      </div>

      {/* Features grid */}
      <div className="px-6 pb-12 max-w-5xl mx-auto">
        <h2 className="text-2xl font-bold text-gray-900 text-center mb-2">核心功能</h2>
        <p className="text-gray-500 text-sm text-center mb-8">從平台串接到自動報價，全程 AI 處理</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {FEATURES.map(f => {
            const Icon = f.icon
            return (
              <div key={f.title} className="bg-white rounded-2xl border p-5 hover:shadow-md transition-all hover:-translate-y-0.5">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-4 ${f.bg}`}>
                  <Icon className={`h-5 w-5 ${f.iconColor}`} />
                </div>
                <h3 className="font-semibold text-gray-900 mb-2">{f.title}</h3>
                <p className="text-xs text-gray-500 leading-relaxed mb-3">{f.desc}</p>
                <ul className="space-y-1">
                  {f.points.map(pt => (
                    <li key={pt} className="flex items-center gap-1.5 text-xs text-gray-600">
                      <CheckCircle2 className="h-3.5 w-3.5 text-green-500 shrink-0" />
                      {pt}
                    </li>
                  ))}
                </ul>
              </div>
            )
          })}
        </div>
      </div>

      {/* How it works */}
      <div className="px-6 pb-16 max-w-5xl mx-auto">
        <h2 className="text-2xl font-bold text-gray-900 text-center mb-2">快速上手</h2>
        <p className="text-gray-500 text-sm text-center mb-8">4 個步驟，30 分鐘內啟動 AI 客服</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {STEPS.map((s, i) => (
            <div key={s.num} className="relative">
              {i < STEPS.length - 1 && (
                <div className="hidden lg:block absolute top-6 left-[calc(100%-8px)] w-4 h-px bg-gray-200 z-10" />
              )}
              <div className="bg-white rounded-2xl border p-5 h-full">
                <div className="text-2xl font-black mb-3"
                  style={{ color: 'color-mix(in oklch, var(--primary) 30%, transparent)' }}>
                  {s.num}
                </div>
                <h3 className="font-semibold text-gray-900 mb-1 text-sm">{s.title}</h3>
                <p className="text-xs text-gray-500 leading-relaxed">{s.desc}</p>
              </div>
            </div>
          ))}
        </div>

        {/* CTA */}
        <div className="mt-10 text-center">
          <Link href="/marketing-auto?module=cs"
            className="inline-flex items-center gap-2 px-8 py-4 rounded-2xl text-base font-bold text-white shadow-xl transition-all hover:shadow-2xl hover:-translate-y-1"
            style={{ background: 'linear-gradient(135deg, var(--primary), color-mix(in oklch, var(--primary) 60%, violet))' }}>
            <Headphones className="h-5 w-5" />
            立即設定客服系統
            <ArrowRight className="h-5 w-5" />
          </Link>
          <p className="text-xs text-gray-400 mt-3 flex items-center justify-center gap-1">
            <Globe className="h-3.5 w-3.5" />
            支援繁中、英文、越語等多語言自動偵測
          </p>
        </div>
      </div>
    </div>
  )
}
