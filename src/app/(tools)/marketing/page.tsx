import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import {
  Megaphone, Sparkles, GitBranch, BarChart3,
  ArrowRight, Zap, Target, Layers, Phone,
} from 'lucide-react'

const FEATURES = [
  {
    title: '行銷自動化',
    desc: '從資料蒐集、競品分析、文案生成、圖片影片製作，到平台上傳的全流程自動化行銷系統',
    icon: Megaphone,
    href: '/marketing-auto',
    color: 'from-violet-500 to-purple-600',
    badge: '完整功能',
    tags: ['資料蒐集', '文案生成', '圖片影片', '自動上傳'],
  },
  {
    title: 'AI 產品行銷設計師',
    desc: '上傳產品圖片，AI 自動生成行銷策略、內容組合、市場分析與 SEO 內容策略，四步驟產出完整行銷包',
    icon: Sparkles,
    href: '/marketing/product-designer',
    color: 'from-pink-500 to-rose-600',
    badge: '新功能',
    tags: ['策略規劃', '內容組合', '市場分析', 'SEO 策略'],
  },
  {
    title: '行銷流水線',
    desc: '視覺化行銷任務排程與進度追蹤，管理多個行銷活動的執行狀態與 Telegram 審核流程',
    icon: GitBranch,
    href: '/marketing-pipeline',
    color: 'from-blue-500 to-cyan-600',
    badge: '進階功能',
    tags: ['任務排程', '進度追蹤', 'Telegram 審核', '多活動管理'],
  },
  {
    title: '潛在客戶行銷',
    desc: '自動蒐集組織 → AI 篩選分類 → 距離計算 → 電話撥打 / Email 寄送，主動開發潛在客戶',
    icon: Phone,
    href: '/prospect-call',
    color: 'from-teal-500 to-emerald-600',
    badge: '開發工具',
    tags: ['自動蒐集', 'AI 篩選', '電話行銷', 'Email 行銷'],
  },
  {
    title: '市場競品分析',
    desc: 'SWOT 分析、競爭對手監控、消費者行為洞察，AI 深度分析讓決策更有依據',
    icon: BarChart3,
    href: '/marketing-auto',
    color: 'from-emerald-500 to-teal-600',
    badge: '整合於行銷自動化',
    tags: ['SWOT 分析', '競品監控', '消費者洞察', 'AI 分析'],
    secondary: true,
  },
  {
    title: '目標客群模擬',
    desc: '多維度消費者模擬引擎，預測行銷活動對不同受眾群體的反應與轉換率',
    icon: Target,
    href: '/marketing-auto',
    color: 'from-orange-500 to-amber-600',
    badge: '整合於行銷自動化',
    tags: ['受眾模擬', '轉換預測', '情緒分析', '策略優化'],
    secondary: true,
  },
  {
    title: '品牌資料庫',
    desc: '集中管理品牌素材、公司資料與行銷知識庫，AI 快取技術節省每次調用的 Token 成本',
    icon: Layers,
    href: '/settings',
    color: 'from-slate-500 to-gray-600',
    badge: '設定中管理',
    tags: ['素材管理', '公司資料', 'AI 快取', 'Token 節省'],
    secondary: true,
  },
]

export default async function MarketingPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  return (
    <div className="h-full overflow-y-auto bg-slate-50/50 dark:bg-background">
      {/* Hero */}
      <div className="bg-gradient-to-br from-violet-600 via-purple-600 to-pink-600 text-white px-6 py-10">
        <div className="max-w-5xl mx-auto">
          <div className="flex items-center gap-2 text-violet-200 text-sm mb-3">
            <Zap className="h-4 w-4" />
            <span>AI GATE 行銷中心</span>
          </div>
          <h1 className="text-3xl font-bold mb-2">行銷中心</h1>
          <p className="text-violet-100 text-base max-w-xl">
            整合 AI 驅動的完整行銷工具鏈 — 從策略規劃、內容創作到自動化執行，一站完成
          </p>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-8">
        {/* Primary features */}
        <div className="mb-3">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-widest mb-4">核心功能</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {FEATURES.filter(f => !f.secondary).map(feature => {
              const Icon = feature.icon
              return (
                <Link
                  key={feature.title}
                  href={feature.href}
                  className="group relative bg-white dark:bg-card border border-border rounded-xl p-5 hover:shadow-lg transition-all duration-200 hover:-translate-y-0.5"
                >
                  <div className={`inline-flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br ${feature.color} mb-4 shadow-sm`}>
                    <Icon className="h-5 w-5 text-white" />
                  </div>
                  <div className="flex items-start justify-between mb-1.5">
                    <h3 className="font-bold text-base">{feature.title}</h3>
                    <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-primary/10 text-primary ml-2 shrink-0">{feature.badge}</span>
                  </div>
                  <p className="text-sm text-muted-foreground mb-3 leading-relaxed">{feature.desc}</p>
                  <div className="flex flex-wrap gap-1.5 mb-4">
                    {feature.tags.map(tag => (
                      <span key={tag} className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-muted-foreground">{tag}</span>
                    ))}
                  </div>
                  <div className="flex items-center gap-1 text-sm font-medium text-primary group-hover:gap-2 transition-all">
                    <span>進入</span>
                    <ArrowRight className="h-3.5 w-3.5" />
                  </div>
                </Link>
              )
            })}
          </div>
        </div>

        {/* Secondary / integrated features */}
        <div className="mt-6">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-widest mb-4">整合功能</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {FEATURES.filter(f => f.secondary).map(feature => {
              const Icon = feature.icon
              return (
                <Link
                  key={feature.title}
                  href={feature.href}
                  className="group flex gap-3 bg-white dark:bg-card border border-border rounded-xl p-4 hover:shadow-md transition-all duration-200"
                >
                  <div className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br ${feature.color}`}>
                    <Icon className="h-4 w-4 text-white" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <h3 className="font-semibold text-sm truncate">{feature.title}</h3>
                    </div>
                    <p className="text-xs text-muted-foreground line-clamp-2">{feature.desc}</p>
                    <p className="text-[10px] text-primary mt-1">{feature.badge} →</p>
                  </div>
                </Link>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
