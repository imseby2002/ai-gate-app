import Link from 'next/link'
import type { Metadata } from 'next'
import {
  Sparkles, Share2, Megaphone, Wand2, Search, GitBranch, Phone, BarChart3, Target, Layers, Brain, ArrowRight,
} from 'lucide-react'
import { DarkHeader, FinalCta, IntroFooter, GradText } from '../_ui'

export const marketingFeaturesMetadata: Metadata = {
  title: '功能詳解｜AI GATE 行銷中心',
  description: 'AI GATE 行銷中心 11 大功能與 13 項 AI 專家技能完整說明：內容製作、潛在客戶開發、市場分析、行銷流水線。',
}

type Feature = {
  id: string
  Icon: React.ComponentType<{ className?: string }>
  title: string
  lead: string
  desc: string
  points: string[]
  plan?: string
}

const GROUPS: Array<{ id: string; n: string; title: string; sub: string; items: Feature[] }> = [
  {
    id: 'content', n: '01', title: '內容，AI 幫你做', sub: '從一張產品圖，到可以直接發佈的圖文與短影音。',
    items: [
      {
        id: 'designer', Icon: Sparkles, title: 'AI 產品行銷設計師',
        lead: '上傳產品圖，四步驟拿到完整行銷包。',
        desc: 'AI 自動生成行銷策略、內容組合、市場分析與 SEO 內容策略，不用自己想切角。',
        points: ['行銷策略規劃', '內容組合', '市場分析', 'SEO 內容策略'],
        plan: 'CORE 起（策略＋文案）· PRO 全開',
      },
      {
        id: 'templates', Icon: Sparkles, title: '視覺風格與廣告創作',
        lead: '不用會寫提示詞，選「感覺」就能出圖。',
        desc: '85 種視覺風格、185 款行銷短影音分鏡模板，選好呈現方式即產出專業圖文與短影音。',
        points: ['85 款呈現風格', '商品擬人／黏土風', '大促／折扣／免運主題', '一鍵組裝 Prompt', '高畫質商用圖'],
      },
      {
        id: 'studio', Icon: Wand2, title: 'AI 視覺工坊',
        lead: '用一句話串起修圖、換風格、去背、生影片。',
        desc: 'ComfyUI 概念的圖片＋影片流水線：上傳圖片，用自然語言串接多個 AI 節點，一鍵跑完。',
        points: ['AI 修圖', '風格轉換', '去除背景', '高清放大', '圖生影片'],
        plan: 'PRO 起（基礎節點）· MAX 全節點',
      },
      {
        id: 'geo', Icon: Search, title: 'GEO 內容寫手',
        lead: '讓 ChatGPT、Perplexity、Google AI 摘要引用你。',
        desc: '填主題與獨家資訊，AI 探勘高意圖問句，產出容易被 AI 搜尋引用的文章，並附 JSON-LD 結構化資料。',
        points: ['問句探勘', '意圖分類', 'JSON-LD', 'AI 引用優化'],
        plan: '免費每月 1 篇 · CORE 起無限',
      },
      {
        id: 'experts', Icon: Brain, title: '13 項 AI 專家技能',
        lead: '內建各領域專家，按需叫用。',
        desc: '電商商品文案、行銷推廣文案、短影音爆款腳本、文章自動配圖、市場研究報告、商品影片企劃、電商帶貨短影片腳本、AI 語音配音、簡報生成（PPTX）、社群帳號運營教練、病毒內容企劃、社群人設文案、開播／直播文案。',
        points: ['全方案可用（依點數）', '自製專家：PRO 起可建立'],
        plan: '全方案',
      },
    ],
  },
  {
    id: 'reach', n: '02', title: '客人，AI 幫你找', sub: '主動出擊，不再只等客人上門。',
    items: [
      {
        id: 'prospect', Icon: Phone, title: '潛在客戶行銷',
        lead: '名單自己來，聯繫自己跑。',
        desc: '自動蒐集組織 → AI 篩選分類 → 距離計算 → 電話撥打／Email 寄送，主動開發潛在客戶。',
        points: ['自動蒐集名單', 'AI 篩選分類', '距離計算', 'AI 電訪', 'Email 行銷'],
        plan: '免費：蒐集＋篩選 · CORE：+Email · PRO：+電話',
      },
      {
        id: 'social-matrix', Icon: Share2, title: '社群矩陣與自動養號',
        lead: '多帳號、多平台，同時經營。',
        desc: '支援住宅 IP 與代理池綁定、14 天擬人化自動養號、真人 Copilot 與矩陣自動發文兩種模式，搭配 AI 目標社群雷達與防封防重文案庫。',
        points: ['代理池管理', 'AI 自動養號', 'Copilot／自動發文', 'FB／IG／Threads／TikTok'],
      },
    ],
  },
  {
    id: 'insight', n: '03', title: '市場，AI 幫你看', sub: '決策前先看清楚，別讓預算賭運氣。',
    items: [
      {
        id: 'swot', Icon: BarChart3, title: '市場競品分析',
        lead: '對手在做什麼，一份報告看懂。',
        desc: 'SWOT 分析、競爭對手監控、消費者行為洞察，整合在行銷自動化流程中。',
        points: ['SWOT 分析', '競品監控', '消費者洞察'],
      },
      {
        id: 'audience', Icon: Target, title: '目標客群模擬',
        lead: '還沒花錢，先預測反應。',
        desc: '多維度消費者模擬引擎，預測行銷活動對不同受眾的反應與轉換率。',
        points: ['受眾模擬', '轉換預測', '情緒分析', '策略優化'],
      },
      {
        id: 'brand', Icon: Layers, title: '品牌資料庫',
        lead: '設定一次，每次產出都像你。',
        desc: '集中管理品牌素材、公司資料與行銷知識庫，並以 AI 快取節省每次調用的成本。',
        points: ['素材管理', '公司資料', 'AI 快取'],
      },
    ],
  },
  {
    id: 'pipeline', n: '04', title: '全部串起來，自動跑', sub: '這是 AI GATE 和單一 AI 工具最大的不同。',
    items: [
      {
        id: 'auto', Icon: Megaphone, title: '行銷自動化',
        lead: '一個行銷案，從頭做到尾。',
        desc: '資料蒐集、競品分析、文案生成、圖片影片製作，到平台上傳的全流程自動化。',
        points: ['資料蒐集', '文案生成', '圖片（CORE 起）', '影片（PRO 起）', '主播影片（MAX）', '自動上傳平台'],
        plan: '免費起',
      },
      {
        id: 'marketing-pipeline', Icon: GitBranch, title: '行銷流水線',
        lead: '排好時間，它自己跑；你只要審核。',
        desc: '視覺化排程與進度追蹤，同時管理多個行銷活動，每一步可透過 Telegram 審核後再放行。',
        points: ['任務排程', '進度追蹤', 'Telegram 審核', '多活動管理'],
        plan: 'PRO 起',
      },
    ],
  },
]

export function MarketingFeatures() {
  return (
    <div className="min-h-screen bg-[#f5f3f8] text-[#17131f] scroll-smooth">
      <DarkHeader
        eyebrow="功能詳解"
        title={<>11 大功能，<GradText>一個目標</GradText>：讓你賣更多。</>}
        sub="每個功能在做什麼、能幫你省下什麼、哪個方案開始可用，都在這裡。"
      />

      <div className="sticky top-0 z-10 bg-[#f5f3f8]/90 backdrop-blur border-b border-[#e6e2ee]">
        <div className="max-w-5xl mx-auto px-6 py-3 flex gap-2 overflow-x-auto text-[14px] font-bold">
          {GROUPS.map(g => (
            <a key={g.id} href={`#${g.id}`} className="shrink-0 rounded-full border border-[#e6e2ee] bg-white px-3 py-1 hover:border-[#6a4be0] hover:text-[#6a4be0]">
              {g.n} {g.title}
            </a>
          ))}
        </div>
      </div>

      {GROUPS.map(g => (
        <section key={g.id} id={g.id} className="max-w-5xl mx-auto px-6 pt-14 scroll-mt-16">
          <div className="font-mono font-extrabold text-[14px] text-[#e0479b]">{g.n}</div>
          <h2 className="text-[clamp(24px,4vw,34px)] font-black tracking-tight">{g.title}</h2>
          <p className="text-[#3f3a4d] text-[15px] mb-6">{g.sub}</p>
          <div className="grid gap-3.5 sm:grid-cols-2">
            {g.items.map(f => (
              <article key={f.id} id={f.id} className="flex flex-col gap-2.5 rounded-2xl border border-[#e6e2ee] bg-white p-5 scroll-mt-16">
                <div className="flex items-center gap-2.5">
                  <f.Icon className="h-5 w-5 text-[#6a4be0] shrink-0" />
                  <h3 className="font-black text-[18px] tracking-tight">{f.title}</h3>
                </div>
                <div className="text-[15px] font-bold">{f.lead}</div>
                <p className="text-[15px] text-[#3f3a4d] leading-relaxed">{f.desc}</p>
                <div className="flex flex-wrap gap-1.5">
                  {f.points.map(p => <span key={p} className="text-[12.5px] text-[#3f3a4d] bg-[#efecf5] rounded-md px-2 py-0.5">{p}</span>)}
                </div>
                {f.plan && (
                  <div className="mt-auto pt-2 text-[13px] font-bold text-[#6a4be0]">可用方案：{f.plan}</div>
                )}
              </article>
            ))}
          </div>
        </section>
      ))}

      <section className="max-w-5xl mx-auto px-6 py-14">
        <Link href="/intro/pricing" className="group flex items-center justify-between gap-4 rounded-2xl border border-[#6a4be0] bg-white p-6 hover:shadow-[0_16px_40px_rgba(60,40,120,0.12)]">
          <div>
            <div className="font-black text-[20px]">哪個方案適合我？</div>
            <div className="text-[14px] text-[#3f3a4d]">免費／CORE／PRO／MAX，逐項功能比較。</div>
          </div>
          <ArrowRight className="h-5 w-5 text-[#6a4be0] group-hover:translate-x-1 transition-transform" />
        </Link>
      </section>

      <FinalCta title={<>先免費跑一個行銷案，<br />看看 AI 能幫你做多少。</>} />
      <IntroFooter />
    </div>
  )
}
