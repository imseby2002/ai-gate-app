import Link from 'next/link'
import type { Metadata } from 'next'
import { Zap, Sparkles, Users, BarChart3, ArrowRight } from 'lucide-react'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'AI GATE 行銷中心｜一個人就是一整個行銷部',
  description: '找客、產內容、自動投放、盯口碑，一站搞定。AI GATE 行銷中心整合 11+ 行銷功能與 13 位 AI 專家。',
}

const PILLARS = [
  {
    n: '01', Icon: Sparkles, title: '內容不用自己做',
    one: '上傳一張產品圖，文案、配圖、短影音腳本自動生好。',
    chips: ['產品設計師', 'AI 視覺工坊', '短影音爆款', 'GEO 內容', '13 位 AI 專家'],
  },
  {
    n: '02', Icon: Users, title: '自動找客、主動觸及',
    one: 'AI 幫你挖名單、分類，電話／Email／簡訊自動發，社群自動養號發文。',
    chips: ['潛在客戶行銷', 'AI 語音外撥', '簡訊批次', '社群矩陣養號'],
  },
  {
    n: '03', Icon: BarChart3, title: '看懂市場與口碑',
    one: '對手在幹嘛、客人在罵什麼、怎麼被 AI 搜尋看到，一眼掌握。',
    chips: ['7 種市場分析', '口碑體檢', '客群模擬', 'GEO 引用優化'],
  },
]

const FLOW = ['蒐集資訊', '分析＋口碑', '文案', '圖片', '爆款影片 🔥', '自動上架', '開發客戶']

const HOOKS = [
  { title: '測你的口碑健康度', desc: '輸入店名，AI 抓 Google 評論，給你負評主題與改善方向。' },
  { title: '生一支爆款短影音腳本', desc: '填主題，30 秒產出前 3 秒鉤子＋分鏡＋CTA。' },
  { title: 'GEO 文章健檢', desc: '看看你的內容能不能被 ChatGPT／Google AIO 引用。' },
]

const TIERS = [
  { t: 'FREE', d: '單點工具試用，體驗核心 aha moment。', tag: '個人試玩', hi: false },
  { t: 'PRO', d: '完整內容製作＋分析＋潛客開發，一個人扛整個行銷。', tag: '小店 / 個人品牌', hi: false },
  { t: 'TEAM+', d: '自製專家訓練、專屬知識庫、流水線全自動排程。', tag: '團隊 / 企業', hi: true },
]

const GRAD = 'linear-gradient(100deg,#7b5cf0,#a34be0 42%,#e0479b)'

export default function MarketingIntroPage() {
  return (
    <div className="min-h-screen bg-[#f5f3f8] text-[#17131f]">
      {/* HERO */}
      <header className="relative overflow-hidden bg-[#161020] text-[#f4f0fb]">
        <div
          className="pointer-events-none absolute -top-1/3 inset-x-0 h-[70%]"
          style={{ background: 'radial-gradient(60% 100% at 30% 0,rgba(123,92,240,.42),transparent 70%),radial-gradient(50% 100% at 85% 10%,rgba(224,71,155,.30),transparent 70%)' }}
        />
        <div className="relative max-w-5xl mx-auto px-6">
          <nav className="flex items-center gap-3 pt-6 pb-10">
            <span className="grid place-items-center w-8 h-8 rounded-lg text-white font-black shrink-0" style={{ background: GRAD }}>⚡</span>
            <b className="font-black tracking-wide">AI GATE 行銷中心</b>
            <span className="ml-auto text-xs text-[#b3aac6] font-mono">marketing.im-tourist.com</span>
          </nav>

          <div className="pb-16 sm:pb-20">
            <div className="font-mono text-[12px] tracking-[0.22em] uppercase text-[#c9b7ff]">AI · 行銷自動化平台</div>
            <h1 className="mt-4 font-black leading-[1.02] tracking-tight text-[clamp(38px,8.5vw,72px)]" style={{ textWrap: 'balance' } as React.CSSProperties}>
              一個人，<br />就是一整個
              <span style={{ background: GRAD, WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent' }}>行銷部</span>。
            </h1>
            <p className="mt-5 text-[#b3aac6] text-[clamp(16px,2.4vw,20px)] max-w-[46ch]">
              找客、產內容、自動投放、盯口碑——本來要一整組人做的事，AI GATE 一站幫你搞定。
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/register" className="inline-flex items-center gap-2 font-bold text-[15px] px-6 py-3 rounded-xl text-white transition-transform hover:-translate-y-0.5"
                style={{ background: GRAD, boxShadow: '0 10px 26px rgba(123,92,240,.4)' }}>
                免費開始 <ArrowRight className="h-4 w-4" />
              </Link>
              <a href="#pillars" className="inline-flex items-center gap-2 font-bold text-[15px] px-6 py-3 rounded-xl text-[#f4f0fb] border border-[#2c2440] bg-white/5 transition-transform hover:-translate-y-0.5">
                看它能做什麼
              </a>
            </div>
            <div className="mt-9 flex flex-wrap gap-6 text-[13px] text-[#b3aac6]">
              <span><b className="text-[#f4f0fb] font-extrabold">11</b> 大功能一站整合</span>
              <span><b className="text-[#f4f0fb] font-extrabold">13</b> 位內建 AI 專家</span>
              <span>電話 · Email · 簡訊 · 社群 <b className="text-[#f4f0fb] font-extrabold">全通路</b></span>
            </div>
          </div>
        </div>
      </header>

      {/* PAIN */}
      <div className="border-b border-[#e6e2ee]">
        <div className="max-w-5xl mx-auto px-6 py-7">
          <p className="text-[clamp(17px,2.6vw,22px)] font-medium leading-snug" style={{ textWrap: 'balance' } as React.CSSProperties}>
            你不需要學會 20 個工具。
            <span className="text-[#938da3]"> 你只需要結果：客人變多、內容不用自己做、對手在幹嘛你都知道。</span>
          </p>
        </div>
      </div>

      {/* PILLARS */}
      <section id="pillars" className="max-w-5xl mx-auto px-6 py-14">
        <div className="font-mono text-[12px] tracking-[0.16em] uppercase text-[#6a4be0] mb-2">它幫你做三件事</div>
        <h2 className="text-[clamp(24px,4vw,34px)] font-black tracking-tight mb-1">複雜的功能，其實只解決三個問題</h2>
        <p className="text-[#615c70] text-[15px] max-w-[56ch] mb-7">每一根支柱都對應你真正在意的結果，底下才是實現它的工具。</p>
        <div className="grid gap-3.5 sm:grid-cols-3">
          {PILLARS.map(p => (
            <div key={p.n} className="flex flex-col gap-3 rounded-2xl border border-[#e6e2ee] bg-white p-5 transition-transform hover:-translate-y-1 hover:shadow-[0_16px_40px_rgba(60,40,120,0.12)]">
              <div className="flex items-center justify-between">
                <p.Icon className="h-5 w-5 text-[#6a4be0]" />
                <span className="font-mono font-extrabold text-[13px] text-[#e0479b]">{p.n}</span>
              </div>
              <h3 className="font-black text-[20px] tracking-tight">{p.title}</h3>
              <div className="text-[14px] font-medium">{p.one}</div>
              <div className="mt-auto flex flex-wrap gap-1.5 pt-1">
                {p.chips.map(c => <span key={c} className="text-[11.5px] text-[#615c70] bg-[#efecf5] rounded-md px-2 py-0.5">{c}</span>)}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* KILLER */}
      <section className="relative overflow-hidden bg-[#161020] text-[#f4f0fb]">
        <div className="pointer-events-none absolute inset-x-0 h-[80%]"
          style={{ bottom: '-40%', background: 'radial-gradient(50% 100% at 70% 100%,rgba(224,71,155,.28),transparent 70%),radial-gradient(50% 100% at 20% 100%,rgba(123,92,240,.30),transparent 70%)' }} />
        <div className="relative max-w-5xl mx-auto px-6 py-14">
          <div className="font-mono text-[12px] tracking-[0.22em] uppercase text-[#ffb3da]">最強差異</div>
          <h2 className="mt-2 mb-2 text-[clamp(24px,4.4vw,38px)] font-black tracking-tight" style={{ textWrap: 'balance' } as React.CSSProperties}>
            把這三件事，串成
            <span style={{ background: GRAD, WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent' }}>一鍵全自動</span>
          </h2>
          <p className="text-[#b3aac6] max-w-[54ch] mb-6">
            行銷流水線：從蒐集資料到發佈上架，整條流程一次跑完，還能定時排程、Telegram 審核。影片腳本自動套用「短影音爆款」方法論。
          </p>
          <div className="flex flex-wrap items-center gap-2">
            {FLOW.map((s, i) => (
              <span key={s} className="flex items-center gap-2">
                <span className="text-[12.5px] rounded-lg px-2.5 py-1.5 border"
                  style={s.includes('爆款')
                    ? { border: '1px solid transparent', background: 'linear-gradient(90deg,rgba(123,92,240,.35),rgba(224,71,155,.35))' }
                    : { borderColor: '#2c2440', background: '#1e1730' }}>
                  <span className="font-mono text-[10px] text-[#c9b7ff] font-bold mr-1.5">{String(i + 1).padStart(2, '0')}</span>{s}
                </span>
                {i < FLOW.length - 1 && <span className="text-[#6a5a8f] text-[13px]">→</span>}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* FREE HOOKS */}
      <section className="max-w-5xl mx-auto px-6 py-14">
        <div className="font-mono text-[12px] tracking-[0.16em] uppercase text-[#6a4be0] mb-2">先免費體驗，再決定</div>
        <h2 className="text-[clamp(24px,4vw,34px)] font-black tracking-tight mb-1">30 秒，產出你的第一個成品</h2>
        <p className="text-[#615c70] text-[15px] max-w-[56ch] mb-7">不用先付費、不用學設定，先感受「原來這麼省事」的那一刻。</p>
        <div className="grid gap-3.5 sm:grid-cols-3">
          {HOOKS.map(h => (
            <div key={h.title} className="flex flex-col gap-2 rounded-2xl border border-dashed border-[#d9d3e6] bg-white p-5">
              <span className="self-start text-[11px] font-bold tracking-wide text-[#0f9d6e] rounded-full px-2.5 py-0.5" style={{ background: 'rgba(15,157,110,.12)' }}>免費</span>
              <h4 className="font-extrabold text-[16px]">{h.title}</h4>
              <p className="text-[13px] text-[#615c70]">{h.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* PRICING */}
      <section className="max-w-5xl mx-auto px-6 pb-14">
        <div className="font-mono text-[12px] tracking-[0.16em] uppercase text-[#6a4be0] mb-2">方案</div>
        <h2 className="text-[clamp(24px,4vw,34px)] font-black tracking-tight mb-7">從單點免費，到一條龍全自動</h2>
        <div className="grid gap-3 sm:grid-cols-3">
          {TIERS.map(t => (
            <div key={t.t} className={`rounded-2xl bg-white p-5 border ${t.hi ? 'border-[#6a4be0] shadow-[inset_0_0_0_1px_#6a4be0]' : 'border-[#e6e2ee]'}`}>
              <div className="font-extrabold tracking-widest text-[14px]">{t.t}</div>
              <div className="text-[#615c70] text-[13px] mt-1.5">{t.d}</div>
              <span className="inline-block mt-2 text-[11px] font-bold text-[#6a4be0]">{t.tag}</span>
            </div>
          ))}
        </div>
      </section>

      {/* FINAL CTA */}
      <section className="relative overflow-hidden bg-[#161020] text-[#f4f0fb]">
        <div className="pointer-events-none absolute -top-1/3 inset-x-0 h-[70%]"
          style={{ background: 'radial-gradient(60% 100% at 50% 0,rgba(123,92,240,.34),transparent 70%)' }} />
        <div className="relative max-w-5xl mx-auto px-6 py-16 text-center">
          <div className="font-mono text-[12px] tracking-[0.22em] uppercase text-[#c9b7ff]">準備好了嗎</div>
          <h2 className="mt-3 mb-6 text-[clamp(26px,5vw,42px)] font-black tracking-tight" style={{ textWrap: 'balance' } as React.CSSProperties}>
            今天就讓 AI<br />當你的行銷部。
          </h2>
          <div className="flex flex-wrap gap-3 justify-center">
            <Link href="/register" className="inline-flex items-center gap-2 font-bold text-[15px] px-6 py-3 rounded-xl text-white transition-transform hover:-translate-y-0.5"
              style={{ background: GRAD, boxShadow: '0 10px 26px rgba(123,92,240,.4)' }}>
              免費開始 <ArrowRight className="h-4 w-4" />
            </Link>
            <Link href="/login" className="inline-flex items-center gap-2 font-bold text-[15px] px-6 py-3 rounded-xl text-[#f4f0fb] border border-[#2c2440] bg-white/5 transition-transform hover:-translate-y-0.5">
              我已有帳號
            </Link>
          </div>
        </div>
      </section>

      <footer className="text-center text-[#938da3] text-[12px] py-7 flex items-center justify-center gap-2">
        <Zap className="h-3.5 w-3.5" /> AI GATE 行銷中心 · marketing.im-tourist.com · IMT
      </footer>
    </div>
  )
}
