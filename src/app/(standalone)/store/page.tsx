'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import {
  Store, BarChart3, Boxes, Receipt, Wrench, Calendar, ShoppingBag,
  ArrowRight, ArrowLeft, ShieldCheck, CheckCircle2, Building2,
  Sparkles, ExternalLink, RefreshCw, Loader2, Compass
} from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

interface StoreFeature {
  href: string
  title: string
  subtitle: string
  description: string
  icon: any
  color: string
  chip: string
  ring: string
  tags: string[]
}

const STORE_FEATURES: StoreFeature[] = [
  {
    href: '/store-coach',
    title: '門市營運教練 AI',
    subtitle: 'Store Management Coach AI',
    description: '七大營運維度、現場動線空間配置、90秒快閃清潔、十層全景診斷與現場視覺 AI（看現場）。',
    icon: Compass,
    color: 'text-emerald-600 dark:text-emerald-400',
    chip: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
    ring: 'hover:border-emerald-500/60 ring-1 ring-emerald-500/30',
    tags: ['10層全景診斷', '現場視覺AI', '動線工效', '90秒清潔'],
  },
  {
    href: '/repair?tab=ai&mode=store',
    title: '門市設備快速排查 AI',
    subtitle: 'Equipment Diagnostic Assistant',
    description: '封口機、果糖機、萃茶機與 POS 出單機故障免拆機快速引導、防呆安全與一鍵轉報修。',
    icon: Wrench,
    color: 'text-amber-600 dark:text-amber-400',
    chip: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
    ring: 'hover:border-amber-500/60 ring-1 ring-amber-500/30',
    tags: ['免拆機排查', '3分鐘診斷', '安全防呆', '一鍵報修'],
  },
  {
    href: '/store-reports',
    title: '門市報表',
    subtitle: 'Store Reports & Profit',
    description: '門市 POS 業績即時報表、營業額、毛利、毛利率與每日銷售趨勢分析。',
    icon: BarChart3,
    color: 'text-emerald-600 dark:text-emerald-400',
    chip: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
    ring: 'hover:border-emerald-500/60',
    tags: ['業績統計', '毛利損益', '銷售趨勢'],
  },
  {
    href: '/store-inventory',
    title: '盤點・訂貨',
    subtitle: 'Inventory & Purchase Orders',
    description: '原物料庫存盤點、每日門市叫貨訂單、進貨驗收批次與耗損報廢登記。',
    icon: Boxes,
    color: 'text-blue-600 dark:text-blue-400',
    chip: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
    ring: 'hover:border-blue-500/60',
    tags: ['每日盤點', '原物料叫貨', '耗損記錄'],
  },
  {
    href: '/store-bills',
    title: '水電瓦斯冰塊費用',
    subtitle: 'Utilities & Expense Bills',
    description: '每月電費、水費、瓦斯費與冰塊費用填報，支援手機拍照上傳單據發票與簽收憑證。',
    icon: Receipt,
    color: 'text-amber-600 dark:text-amber-400',
    chip: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
    ring: 'hover:border-amber-500/60',
    tags: ['水電', '瓦斯', '冰塊', '單據上傳'],
  },
  {
    href: '/repair',
    title: '門市報修',
    subtitle: 'Equipment Maintenance',
    description: '門市現場設備故障即時申報、維修進度追蹤、派工紀錄與器材保養台帳。',
    icon: Wrench,
    color: 'text-orange-600 dark:text-orange-400',
    chip: 'bg-orange-500/10 text-orange-600 dark:text-orange-400',
    ring: 'hover:border-orange-500/60',
    tags: ['設備叫修', '進度追蹤', '器材保養'],
  },
  {
    href: '/shift',
    title: '門市排班',
    subtitle: 'Staff Shift Scheduling',
    description: '門市人員每週輪值排班表規劃、班別設定、調班申請與出勤工時統計。',
    icon: Calendar,
    color: 'text-violet-600 dark:text-violet-400',
    chip: 'bg-violet-500/10 text-violet-600 dark:text-violet-400',
    ring: 'hover:border-violet-500/60',
    tags: ['人員排班', '輪值調班', '工時統計'],
  },
  {
    href: '/pos',
    title: '門市點單 POS',
    subtitle: 'Counter Order & Register',
    description: '門市現場櫃台收銀點單、飲品客製加料、出單機列印與即時銷售結帳。',
    icon: ShoppingBag,
    color: 'text-pink-600 dark:text-pink-400',
    chip: 'bg-pink-500/10 text-pink-600 dark:text-pink-400',
    ring: 'hover:border-pink-500/60',
    tags: ['前台點單', '收銀出單', '即時銷售'],
  },
]

export default function StoreDepartmentHubPage() {
  const [lockedStore, setLockedStore] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/fin/bills?month=1&year=2026')
      .then(r => (r.ok ? r.json() : null))
      .then(d => {
        if (d?.locked_store) {
          setLockedStore(d.locked_store)
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="max-w-5xl mx-auto px-6 py-8 space-y-6">
      {/* 頂部導航與標題 */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b pb-5">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 text-white flex items-center justify-center shadow-md shadow-amber-500/20">
            <Store className="h-6 w-6" />
          </div>
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="text-2xl font-bold tracking-tight">門市營運中心</h1>
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 font-semibold border border-amber-200 dark:border-amber-800/50">
                門市部門首頁
              </span>
              {lockedStore && (
                <Badge variant="outline" className="bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-300 gap-1 text-xs">
                  🔒 本店專屬 [{lockedStore}]
                </Badge>
              )}
            </div>
            <p className="text-sm text-muted-foreground mt-0.5">
              門市營運全方位作業系統：經營報表、原物料盤點訂貨、日常公用費用、故障報修、員工排班與前台點單
            </p>
          </div>
        </div>

        <Link href="/office">
          <Button variant="outline" size="sm" className="gap-1.5 text-xs">
            <ArrowLeft className="h-4 w-4" />
            返回公司入口
          </Button>
        </Link>
      </div>

      {/* 門市帳號鎖定提示（若綁定門市） */}
      {lockedStore && (
        <div className="p-3.5 rounded-xl border bg-amber-50/60 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800/40 text-xs text-amber-800 dark:text-amber-300 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-amber-600 shrink-0" />
            <span>
              您目前以 <strong>[{lockedStore}] 門市專屬同仁</strong> 身分登入，系統已自動鎖定本店營運範圍，各項報表與數據均僅呈現本店資料。
            </span>
          </div>
        </div>
      )}

      {/* 門市營運教練 AI 旗艦 Banner */}
      <div className="p-4 sm:p-5 rounded-2xl border-2 border-emerald-500/40 bg-gradient-to-r from-emerald-950 via-teal-950 to-slate-950 text-white shadow-md flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 text-emerald-300 flex items-center justify-center shrink-0 border border-emerald-400/30 shadow-xs">
            <Compass className="h-6 w-6" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-base sm:text-lg font-black text-white">
                門市營運教練 AI (Store Management Coach AI)
              </h2>
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-400 text-emerald-950 font-black">
                新旗艦大腦
              </span>
            </div>
            <p className="text-xs sm:text-sm text-emerald-200/90 mt-0.5">
              陪著店長、區督導、門市指導員一同解決現場問題・七大維度・流程分離・十層全景診斷・現場視覺 AI
            </p>
          </div>
        </div>
        <Link href="/store-coach" className="shrink-0 self-start md:self-auto">
          <Button className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs sm:text-sm px-5 rounded-xl gap-1.5 shadow-md cursor-pointer">
            進入教練工作台
            <ArrowRight className="h-4 w-4" />
          </Button>
        </Link>
      </div>

      {/* 門市設備快速排查 AI 快捷通道 */}
      <div className="p-4 rounded-2xl border bg-gradient-to-r from-amber-500/10 via-orange-500/10 to-transparent border-amber-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0 border border-amber-500/30">
            <Wrench className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-foreground">
                ⚡ 門市設備快速排查 AI (免拆機引導・一鍵報修)
              </h3>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/30 font-bold">
                水吧 / POS / IT
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              封口機 E01/E04、果糖機出糖不準、出單機卡紙、錢箱彈不開？現場免拆機 3 步快速排查，若無法解決一鍵送出工單！
            </p>
          </div>
        </div>
        <Link href="/repair?tab=ai&mode=store" className="shrink-0 self-start sm:self-auto">
          <Button size="sm" className="bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold gap-1.5 rounded-xl shadow-xs">
            開始設備排查
            <ArrowRight className="h-3.5 w-3.5" />
          </Button>
        </Link>
      </div>

      {/* 8 大核心功能卡片網格 */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {STORE_FEATURES.map(f => {
          const Icon = f.icon
          return (
            <Link key={f.href} href={f.href} className="group block focus:outline-none">
              <Card className={`p-5 h-full flex flex-col justify-between transition-all duration-200 border hover:shadow-md hover:-translate-y-0.5 ${f.ring}`}>
                <div>
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex items-center gap-3">
                      <div className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 shadow-xs transition-transform group-hover:scale-105 ${f.chip}`}>
                        <Icon className="h-5 w-5" />
                      </div>
                      <div>
                        <h3 className="font-bold text-base text-foreground group-hover:text-primary transition-colors">
                          {f.title}
                        </h3>
                        <span className="text-[11px] text-muted-foreground font-medium">
                          {f.subtitle}
                        </span>
                      </div>
                    </div>
                  </div>

                  <p className="text-xs text-muted-foreground leading-relaxed mb-4">
                    {f.description}
                  </p>

                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {f.tags.map(t => (
                      <span
                        key={t}
                        className="text-[10px] px-2 py-0.5 rounded-md bg-muted/60 text-muted-foreground font-medium"
                      >
                        #{t}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="pt-3 border-t flex items-center justify-between text-xs font-semibold text-primary mt-2">
                  <span className="group-hover:underline">開啟{f.title}</span>
                  <div className="flex items-center gap-1 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all">
                    <span className="text-[11px] font-normal">進入</span>
                    <ArrowRight className="h-4 w-4" />
                  </div>
                </div>
              </Card>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
