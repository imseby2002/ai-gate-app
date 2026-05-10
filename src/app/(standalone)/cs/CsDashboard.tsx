'use client'

import Link from 'next/link'
import {
  MessageSquare, Ticket, Wifi, WifiOff, Settings, FlaskConical,
  Inbox, Database, ArrowRight, RefreshCw, CheckCircle2, Zap,
  BarChart3, ChevronRight,
} from 'lucide-react'

const INDUSTRY_INFO: Record<string, { emoji: string; name: string; gradient: string; tagline: string }> = {
  homestay:  { emoji: '🏡', name: '民宿 / 旅遊',    gradient: 'from-teal-500 to-emerald-600',   tagline: '房型查詢、預訂引導、行程推薦' },
  ecommerce: { emoji: '🛍️', name: '電商 / 零售',   gradient: 'from-orange-500 to-amber-600',   tagline: '訂單查詢、退換貨、物流追蹤' },
  restaurant:{ emoji: '🍽️', name: '餐廳 / 餐飲',   gradient: 'from-red-500 to-rose-600',       tagline: '線上訂位、菜單查詢、外送服務' },
  clinic:    { emoji: '🏥', name: '診所 / 醫美',    gradient: 'from-blue-500 to-indigo-600',    tagline: '預約掛號、療程諮詢、術後照護' },
  beauty:    { emoji: '💆', name: '美容 / SPA',     gradient: 'from-pink-500 to-rose-600',      tagline: '服務預約、設計師選擇、護理建議' },
  education: { emoji: '📚', name: '教育 / 補習班',  gradient: 'from-violet-500 to-purple-600',  tagline: '課程諮詢、試聽預約、師資介紹' },
}

const PLATFORM_LABELS: Record<string, { name: string; emoji: string }> = {
  line:      { name: 'LINE OA', emoji: '💬' },
  whatsapp:  { name: 'WhatsApp', emoji: '📱' },
  telegram:  { name: 'Telegram', emoji: '✈️' },
  instagram: { name: 'Instagram', emoji: '📸' },
  zalo:      { name: 'Zalo', emoji: '🔵' },
  test:      { name: '測試模式', emoji: '🧪' },
}

interface Props {
  industry: string
  todayMessages: number
  openTickets: number
  connectedPlatforms: string[]
}

export function CsDashboard({ industry, todayMessages, openTickets, connectedPlatforms }: Props) {
  const info = INDUSTRY_INFO[industry] ?? INDUSTRY_INFO.homestay
  const csUrl = `/marketing-auto?module=cs&industry=${industry}`

  const quickActions = [
    {
      icon: Inbox,
      label: '統一收件匣',
      desc: '查看所有客戶對話',
      href: csUrl,
      color: 'bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400',
    },
    {
      icon: FlaskConical,
      label: '測試客服機器人',
      desc: '即時模擬對話效果',
      href: csUrl,
      color: 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400',
    },
    {
      icon: Database,
      label: '外部資料來源',
      desc: '管理 Google Sheet 查詢表',
      href: csUrl,
      color: 'bg-violet-50 dark:bg-violet-950/50 text-violet-600 dark:text-violet-400',
    },
    {
      icon: BarChart3,
      label: '客服數據報表',
      desc: '訊息量、工單、情緒趨勢',
      href: csUrl,
      color: 'bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400',
    },
  ]

  return (
    <div className="min-h-full bg-slate-50/50 dark:bg-background">
      <div className="max-w-4xl mx-auto px-6 py-8 space-y-8">

        {/* ── Hero Card ── */}
        <div className={`relative overflow-hidden rounded-3xl bg-gradient-to-br ${info.gradient} p-8 text-white shadow-lg`}>
          {/* Decorative blobs */}
          <div className="pointer-events-none absolute -top-16 -right-16 h-48 w-48 rounded-full bg-white/10 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-10 -left-10 h-36 w-36 rounded-full bg-white/10 blur-2xl" />

          <div className="relative flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="text-5xl leading-none">{info.emoji}</div>
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="inline-flex items-center gap-1.5 text-xs font-semibold bg-white/20 px-2.5 py-1 rounded-full">
                    <span className="h-1.5 w-1.5 rounded-full bg-green-300 animate-pulse" />
                    系統運行中
                  </span>
                </div>
                <h1 className="text-2xl font-extrabold">{info.name} 客服工作台</h1>
                <p className="text-sm text-white/80 mt-0.5">{info.tagline}</p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <Link
                href="/cs?select=1"
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white/20 hover:bg-white/30 transition-colors text-sm font-medium"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                更換行業
              </Link>
              <Link
                href={csUrl}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white text-gray-800 hover:bg-white/90 transition-colors text-sm font-semibold shadow-sm"
              >
                <Settings className="h-3.5 w-3.5" />
                完整設定
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </div>
        </div>

        {/* ── Stats ── */}
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: '今日訊息', value: todayMessages, icon: MessageSquare, color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-50 dark:bg-blue-950/50' },
            { label: '待處理工單', value: openTickets, icon: Ticket, color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-50 dark:bg-amber-950/50' },
            {
              label: '連線平台',
              value: connectedPlatforms.length > 0 ? connectedPlatforms.length : 0,
              icon: connectedPlatforms.length > 0 ? Wifi : WifiOff,
              color: connectedPlatforms.length > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground',
              bg: connectedPlatforms.length > 0 ? 'bg-emerald-50 dark:bg-emerald-950/50' : 'bg-muted/40',
            },
          ].map(stat => (
            <div key={stat.label} className="bg-card rounded-2xl border p-5 shadow-sm">
              <div className="flex items-center gap-3 mb-3">
                <div className={`h-9 w-9 rounded-xl flex items-center justify-center ${stat.bg}`}>
                  <stat.icon className={`h-4 w-4 ${stat.color}`} />
                </div>
                <span className="text-xs text-muted-foreground font-medium">{stat.label}</span>
              </div>
              <div className="text-3xl font-bold tabular-nums">{stat.value}</div>
              {stat.label === '連線平台' && connectedPlatforms.length > 0 && (
                <div className="mt-1 flex flex-wrap gap-1">
                  {connectedPlatforms.slice(0, 3).map(p => (
                    <span key={p} className="text-[10px] text-muted-foreground">
                      {PLATFORM_LABELS[p]?.emoji ?? '🔗'} {PLATFORM_LABELS[p]?.name ?? p}
                    </span>
                  ))}
                </div>
              )}
              {stat.label === '連線平台' && connectedPlatforms.length === 0 && (
                <div className="text-xs text-muted-foreground/60 mt-1">尚未連接平台</div>
              )}
            </div>
          ))}
        </div>

        {/* ── Quick Actions ── */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">快速入口</h2>
          </div>
          <div className="grid grid-cols-2 gap-4">
            {quickActions.map(action => (
              <Link
                key={action.label}
                href={action.href}
                className="group bg-card rounded-2xl border p-5 shadow-sm hover:border-primary/40 hover:shadow-md transition-all"
              >
                <div className="flex items-center gap-3 mb-2">
                  <div className={`h-10 w-10 rounded-xl flex items-center justify-center ${action.color} transition-transform group-hover:scale-110`}>
                    <action.icon className="h-5 w-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-sm">{action.label}</div>
                    <div className="text-xs text-muted-foreground">{action.desc}</div>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground/40 group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
                </div>
              </Link>
            ))}
          </div>
        </div>

        {/* ── System Status ── */}
        <div className="bg-card rounded-2xl border p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <Zap className="h-4 w-4 text-primary" />
            <h2 className="font-semibold text-sm">系統狀態</h2>
          </div>
          <div className="space-y-2.5">
            {[
              { label: 'AI 客服引擎', ok: true },
              { label: '平台 Webhook', ok: connectedPlatforms.length > 0 },
              { label: '知識庫', ok: true },
            ].map(item => (
              <div key={item.label} className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">{item.label}</span>
                <span className={`flex items-center gap-1.5 text-xs font-medium ${item.ok ? 'text-emerald-600' : 'text-amber-600'}`}>
                  {item.ok
                    ? <><CheckCircle2 className="h-3.5 w-3.5" /> 正常</>
                    : <><WifiOff className="h-3.5 w-3.5" /> 未設定</>
                  }
                </span>
              </div>
            ))}
          </div>
          <div className="mt-4 pt-4 border-t">
            <Link href={csUrl} className="flex items-center gap-1 text-xs text-primary font-medium hover:underline">
              進入完整設定 <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>

      </div>
    </div>
  )
}
