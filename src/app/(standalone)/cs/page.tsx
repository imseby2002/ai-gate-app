'use client'

import Link from 'next/link'
import { useState } from 'react'
import {
  Headphones, ArrowRight, CheckCircle2, Sparkles, Zap, Shield, Globe,
  Clock, Star, TrendingUp, MessageSquare, Database, Calculator,
  FlaskConical, ClipboardList, Users, AlertTriangle, BarChart3,
  Search, FileText, Languages, Inbox, Ticket, ShoppingCart, ChevronRight,
} from 'lucide-react'

// ─── Industry Templates ───────────────────────────────────────────
const INDUSTRIES = [
  {
    id: 'homestay',
    emoji: '🏡',
    name: '民宿 / 旅遊',
    desc: '房型查詢、預訂流程、退訂政策、行程安排',
    color: 'from-teal-500 to-emerald-600',
    bg: 'bg-teal-50',
    border: 'border-teal-200',
    tags: ['房型預訂', '日期選擇', '退訂政策', '行程推薦'],
  },
  {
    id: 'ecommerce',
    emoji: '🛍️',
    name: '電商 / 零售',
    desc: '訂單查詢、退換貨、物流追蹤、促銷諮詢',
    color: 'from-orange-500 to-amber-600',
    bg: 'bg-orange-50',
    border: 'border-orange-200',
    tags: ['訂單狀態', '退換貨', '物流追蹤', '商品諮詢'],
  },
  {
    id: 'restaurant',
    emoji: '🍽️',
    name: '餐廳 / 餐飲',
    desc: '訂位、外送查詢、菜單介紹、優惠活動',
    color: 'from-red-500 to-rose-600',
    bg: 'bg-red-50',
    border: 'border-red-200',
    tags: ['線上訂位', '菜單查詢', '外送時間', '包廂服務'],
  },
  {
    id: 'clinic',
    emoji: '🏥',
    name: '診所 / 醫美',
    desc: '預約掛號、療程諮詢、術後照護、費用說明',
    color: 'from-blue-500 to-indigo-600',
    bg: 'bg-blue-50',
    border: 'border-blue-200',
    tags: ['線上預約', '療程說明', '費用查詢', '術後問題'],
  },
  {
    id: 'beauty',
    emoji: '💆',
    name: '美容 / 美髮 / SPA',
    desc: '預約服務、價目表、設計師介紹、護理建議',
    color: 'from-pink-500 to-rose-600',
    bg: 'bg-pink-50',
    border: 'border-pink-200',
    tags: ['服務預約', '設計師選擇', '價格諮詢', '護理建議'],
  },
  {
    id: 'education',
    emoji: '📚',
    name: '教育 / 補習班',
    desc: '課程諮詢、試聽預約、學費方案、師資介紹',
    color: 'from-violet-500 to-purple-600',
    bg: 'bg-violet-50',
    border: 'border-violet-200',
    tags: ['課程介紹', '試聽預約', '學費方案', '師資查詢'],
  },
]

// ─── Feature Groups ───────────────────────────────────────────────
const FEATURE_GROUPS = [
  {
    group: '🤖 AI 智能核心',
    color: 'text-violet-700',
    features: [
      { icon: Sparkles, label: '意圖識別', desc: '自動判斷用戶目的（退款/查詢/投訴/購買），分流更精準', status: 'live' },
      { icon: Languages, label: '多語言自動偵測', desc: '自動偵測客戶語言並切換回覆（中/英/越/日/韓等）', status: 'live' },
      { icon: FileText, label: '智慧草稿', desc: 'AI 根據對話生成回覆建議，客服一鍵採用或微調', status: 'live' },
      { icon: MessageSquare, label: '對話摘要', desc: '長對話自動濃縮，交接時不用從頭看', status: 'live' },
    ],
  },
  {
    group: '📊 數據與報表',
    color: 'text-blue-700',
    features: [
      { icon: BarChart3, label: '客服績效報表', desc: '回應速度、解決率、滿意度自動統計', status: 'live' },
      { icon: TrendingUp, label: '情緒趨勢圖', desc: '某時段、某產品的負面情緒爆發點視覺化', status: 'live' },
      { icon: Search, label: '熱點問題統計', desc: '每週最多人問什麼，反映產品缺陷或服務痛點', status: 'live' },
      { icon: Star, label: '自動滿意度問卷', desc: '問題解決後自動發問卷，無回應自動結案', status: 'live' },
    ],
  },
  {
    group: '🎯 客戶管理',
    color: 'text-emerald-700',
    features: [
      { icon: Users, label: 'VIP 識別', desc: '串接 CRM，高價值客戶自動優先排隊、升級處理', status: 'live' },
      { icon: AlertTriangle, label: '流失預警', desc: '偵測「考慮取消」「不想用了」語意，主動介入挽留', status: 'live' },
      { icon: ShoppingCart, label: '訂單查詢串接', desc: '用戶輸入訂單號直接查狀態，不用轉人工', status: 'live' },
      { icon: Ticket, label: '工單系統', desc: '複雜問題轉工單追蹤，不怕漏接', status: 'live' },
    ],
  },
  {
    group: '⚙️ 系統整合',
    color: 'text-orange-700',
    features: [
      { icon: Inbox, label: '統一收件匣', desc: 'LINE / IG / Email 多平台對話集中一個後台管理', status: 'live' },
      { icon: Database, label: '知識庫搜尋', desc: '客服輸入關鍵字，AI 即時推薦相關答案', status: 'live' },
      { icon: Calculator, label: '定價計算機', desc: 'AI 自動套公式計算並告知客戶報價', status: 'live' },
      { icon: Clock, label: '自動結案', desc: '問題解決後自動發滿意度問卷，無回應自動關閉', status: 'live' },
    ],
  },
]

// ─── Platform List ────────────────────────────────────────────────
const PLATFORMS = [
  { name: 'LINE OA', emoji: '💬', color: '#00B900' },
  { name: 'WhatsApp Business', emoji: '📱', color: '#25D366' },
  { name: 'WhatsApp 個人版', emoji: '📲', color: '#128C7E' },
  { name: 'Telegram', emoji: '✈️', color: '#2AABEE' },
  { name: 'Zalo OA', emoji: '🔵', color: '#0068FF' },
  { name: 'WeChat', emoji: '💚', color: '#07C160' },
]

export default function CsHomePage() {
  const [hoveredIndustry, setHoveredIndustry] = useState<string | null>(null)

  return (
    <div className="min-h-full bg-gradient-to-b from-slate-50 to-white">

      {/* ── Hero ── */}
      <div className="px-6 pt-10 pb-8 max-w-5xl mx-auto text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 text-primary text-xs font-semibold mb-5">
          <Sparkles className="h-3.5 w-3.5" />
          AI 智能客服系統
        </div>
        <h1 className="text-3xl sm:text-4xl font-extrabold text-gray-900 mb-3 leading-tight">
          適合每個行業的
          <span className="bg-gradient-to-r from-primary to-violet-600 bg-clip-text text-transparent"> AI 客服助理</span>
        </h1>
        <p className="text-gray-500 text-base max-w-2xl mx-auto mb-6 leading-relaxed">
          不論你是民宿、電商、餐廳還是診所，選擇行業模板一鍵套用，
          30 分鐘內啟動 LINE / WhatsApp AI 客服，24 小時不間斷服務。
        </p>

        {/* Platforms */}
        <div className="flex flex-wrap justify-center gap-2 mb-8">
          {PLATFORMS.map(p => (
            <span key={p.name} className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full border bg-white text-xs text-gray-600 shadow-sm">
              <span>{p.emoji}</span>{p.name}
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: p.color }} />
            </span>
          ))}
        </div>
      </div>

      {/* ── Industry Templates ── */}
      <div className="px-6 pb-10 max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-xl font-bold text-gray-900">選擇你的行業</h2>
            <p className="text-sm text-gray-500 mt-0.5">套用預設模板，AI 自動配置系統提示詞與預訂流程</p>
          </div>
          <Link href="/marketing-auto?module=cs"
            className="hidden sm:flex items-center gap-1.5 text-sm text-primary font-medium hover:underline">
            跳過，直接自訂 <ChevronRight className="h-4 w-4" />
          </Link>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {INDUSTRIES.map(ind => (
            <Link
              key={ind.id}
              href={`/marketing-auto?module=cs&industry=${ind.id}`}
              onMouseEnter={() => setHoveredIndustry(ind.id)}
              onMouseLeave={() => setHoveredIndustry(null)}
              className={`group relative rounded-2xl border-2 p-5 bg-white hover:shadow-lg transition-all hover:-translate-y-0.5 cursor-pointer ${
                hoveredIndustry === ind.id ? ind.border : 'border-gray-100'
              }`}>
              <div className={`w-12 h-12 rounded-2xl flex items-center justify-center mb-3 bg-gradient-to-br ${ind.color} text-2xl`}>
                {ind.emoji}
              </div>
              <h3 className="font-bold text-gray-900 text-sm mb-1">{ind.name}</h3>
              <p className="text-xs text-gray-500 leading-relaxed mb-3">{ind.desc}</p>
              <div className="flex flex-wrap gap-1">
                {ind.tags.map(tag => (
                  <span key={tag} className={`text-[10px] px-1.5 py-0.5 rounded-full ${ind.bg} text-gray-600`}>{tag}</span>
                ))}
              </div>
              <div className={`absolute bottom-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity`}>
                <ArrowRight className="h-4 w-4 text-gray-400" />
              </div>
            </Link>
          ))}
        </div>

        <div className="mt-3 text-center">
          <Link href="/marketing-auto?module=cs" className="text-xs text-gray-400 hover:text-gray-600 transition-colors">
            或直接進入設定，手動配置 →
          </Link>
        </div>
      </div>

      {/* ── Feature Showcase ── */}
      <div className="px-6 pb-12 max-w-5xl mx-auto">
        <div className="text-center mb-8">
          <h2 className="text-xl font-bold text-gray-900 mb-1">完整功能規劃</h2>
          <p className="text-sm text-gray-500">
            <span className="inline-flex items-center gap-1 mr-3">
              <span className="w-2 h-2 rounded-full bg-green-500 inline-block" />已上線
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-gray-300 inline-block" />開發中
            </span>
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          {FEATURE_GROUPS.map(group => (
            <div key={group.group} className="bg-white rounded-2xl border p-5">
              <h3 className={`font-bold text-sm mb-4 ${group.color}`}>{group.group}</h3>
              <div className="space-y-3">
                {group.features.map(f => {
                  const Icon = f.icon
                  return (
                    <div key={f.label} className="flex items-start gap-3">
                      <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${
                        f.status === 'live' ? 'bg-green-50' : 'bg-gray-50'
                      }`}>
                        <Icon className={`h-3.5 w-3.5 ${f.status === 'live' ? 'text-green-600' : 'text-gray-400'}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-semibold text-gray-800">{f.label}</span>
                          {f.status === 'live'
                            ? <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-green-100 text-green-700 font-medium">已上線</span>
                            : <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-500">開發中</span>}
                        </div>
                        <p className="text-[11px] text-gray-400 mt-0.5 leading-relaxed">{f.desc}</p>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── CTA ── */}
      <div className="px-6 pb-16 max-w-5xl mx-auto text-center">
        <div className="bg-gradient-to-br from-primary/5 to-violet-500/5 rounded-3xl border border-primary/10 p-10">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">準備好了嗎？</h2>
          <p className="text-gray-500 text-sm mb-6">選擇行業模板，30 分鐘內啟動 AI 客服</p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link href="/marketing-auto?module=cs"
              className="inline-flex items-center gap-2 px-7 py-3.5 rounded-xl text-sm font-bold text-white shadow-lg transition-all hover:shadow-xl hover:-translate-y-0.5"
              style={{ background: 'linear-gradient(135deg, var(--primary), color-mix(in oklch, var(--primary) 60%, violet))' }}>
              <Headphones className="h-4 w-4" />
              立即設定客服系統
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
          <p className="text-xs text-gray-400 mt-4 flex items-center justify-center gap-1">
            <Shield className="h-3.5 w-3.5" /> 免費使用・不限對話次數・資料加密保護
          </p>
        </div>
      </div>
    </div>
  )
}
