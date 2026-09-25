import Link from 'next/link'
import type { Metadata } from 'next'
import { Sparkles, Users, BarChart3, ArrowRight, Check, X } from 'lucide-react'
import { PLAN_CARDS } from '@/lib/marketing/plan-compare'
import { GRAD, BALANCE, GradText, IntroNav, PrimaryCta, GhostCta, FinalCta, IntroFooter } from './_ui'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'AI GATE 行銷中心｜一個人就是一整個行銷部',
  description: '上傳一張產品圖，AI 寫文案、做圖、出短影音腳本、找名單、自動發送。AI GATE 行銷中心整合 11 大行銷功能與 13 項 AI 專家技能，免費開始。',
}

const PILLARS = [
  {
    id: 'content', n: '01', Icon: Sparkles, title: '內容，AI 幫你做',
    one: '上傳一張產品圖，行銷策略、文案、配圖、短影音分鏡一次產出。85 種視覺風格直接套用，不用會寫提示詞。',
    chips: ['AI 產品行銷設計師', '視覺風格與廣告創作', 'AI 視覺工坊', 'GEO 內容寫手', '13 項 AI 專家技能'],
  },
  {
    id: 'reach', n: '02', Icon: Users, title: '客人，AI 幫你找',
    one: 'AI 自動蒐集潛在客戶、篩選分類，再用電話／Email／簡訊主動聯繫；社群帳號也能矩陣化自動發文。',
    chips: ['潛在客戶行銷', 'AI 電訪', 'Email／簡訊', '社群矩陣與自動養號'],
  },
  {
    id: 'insight', n: '03', Icon: BarChart3, title: '市場，AI 幫你看',
    one: '對手在做什麼、客人在意什麼、哪種受眾最可能買單——SWOT、競品、客群模擬，決策前先看清楚。',
    chips: ['市場競品分析', '目標客群模擬', 'GEO 引用優化', '品牌資料庫'],
  },
]

const COMPARE = [
  { before: '找設計、找寫手、找剪輯，等好幾天', after: '上傳產品圖，AI 當場產出文案與素材' },
  { before: '每天手動發文、換帳號、怕被封', after: '社群矩陣排程發文，防重複文案' },
  { before: '陌生開發靠人力一通通打', after: 'AI 蒐集名單、篩選，自動電訪與寄信' },
  { before: '十幾個工具、十幾組帳密', after: '一個後台，一套點數，全部串起來' },
]

const FLOW = ['蒐集資訊', '競品＋客群分析', '文案', '圖片', '爆款短影音 🔥', '自動上架', '開發客戶']

const FREE_ITEMS = [
  '1 個完整行銷案（資料蒐集／分析／文案）',
  'GEO 內容寫手每月 1 篇',
  '潛在客戶自動蒐集＋AI 篩選',
  '13 項 AI 專家技能（依點數使用）',
]

const FAQ = [
  { q: '免費方案真的能用嗎？', a: '可以。免費帳號就能建立 1 個行銷案、每月寫 1 篇 GEO 文章、蒐集與篩選潛在客戶，覺得好用再升級。' },
  { q: '訂閱費之外還要付什麼？', a: '圖片、影片、主播影片、電訪、Email 等生成成本以儲值點數另計，用多少扣多少。' },
  { q: '會自動續訂嗎？', a: '不會。付款後方案立即生效，到期不自動扣款，需要延續再自行購買。' },
  { q: '年繳划算嗎？', a: '年繳約 8 折，例如 PRO 月繳 $29，年繳 $278（平均每月約 $23）。' },
]

export default function MarketingIntroPage() {
  return (
    <div className="min-h-screen bg-[#f5f3f8] text-[#17131f]">
      {/* HERO */}
      <header className="relative overflow-hidden bg-[#161020] text-[#f4f0fb]">
        <div className="pointer-events-none absolute -top-1/3 inset-x-0 h-[70%]"
          style={{ background: 'radial-gradient(60% 100% at 30% 0,rgba(123,92,240,.42),transparent 70%),radial-gradient(50% 100% at 85% 10%,rgba(224,71,155,.30),transparent 70%)' }} />
        <div className="relative max-w-5xl mx-auto px-6">
          <IntroNav />
          <div className="pb-16 sm:pb-20">
            <div className="font-mono text-[12px] tracking-[0.22em] uppercase text-[#c9b7ff]">AI · 行銷自動化平台</div>
            <h1 className="mt-4 font-black leading-[1.02] tracking-tight text-[clamp(38px,8.5vw,72px)]" style={BALANCE}>
              一個人，<br />就是一整個<GradText>行銷部</GradText>。
            </h1>
            <p className="mt-5 text-[#b3aac6] text-[clamp(16px,2.4vw,20px)] max-w-[48ch]">
              上傳一張產品圖，AI 寫文案、做圖、排短影音、找名單、自動發送。<span className="text-[#f4f0fb]">你只負責按「確認」。</span>
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <PrimaryCta />
              <GhostCta href="/intro/features">看完整功能</GhostCta>
            </div>
            <div className="mt-9 flex flex-wrap gap-6 text-[13px] text-[#b3aac6]">
              <span><b className="text-[#f4f0fb] font-extrabold">11</b> 大行銷功能一站整合</span>
              <span><b className="text-[#f4f0fb] font-extrabold">13</b> 項 AI 專家技能</span>
              <span><b className="text-[#f4f0fb] font-extrabold">85</b> 種視覺風格 · <b className="text-[#f4f0fb] font-extrabold">185</b> 款短影音分鏡</span>
            </div>
          </div>
        </div>
      </header>

      {/* BEFORE / AFTER */}
      <section className="max-w-5xl mx-auto px-6 py-14">
        <div className="font-mono text-[12px] tracking-[0.16em] uppercase text-[#6a4be0] mb-2">差別在哪</div>
        <h2 className="text-[clamp(24px,4vw,34px)] font-black tracking-tight mb-7" style={BALANCE}>你不缺工具，你缺的是時間。</h2>
        <div className="rounded-2xl border border-[#e6e2ee] bg-white overflow-hidden">
          <div className="grid grid-cols-2 text-[12px] font-bold tracking-wide text-[#938da3] bg-[#faf9fc] border-b border-[#e6e2ee]">
            <div className="px-4 py-2.5">以前</div>
            <div className="px-4 py-2.5 text-[#6a4be0]">用 AI GATE</div>
          </div>
          {COMPARE.map(c => (
            <div key={c.before} className="grid grid-cols-2 border-b last:border-b-0 border-[#efecf5] text-[14px]">
              <div className="px-4 py-3.5 flex gap-2 text-[#938da3]"><X className="h-4 w-4 shrink-0 mt-0.5" />{c.before}</div>
              <div className="px-4 py-3.5 flex gap-2 font-medium"><Check className="h-4 w-4 shrink-0 mt-0.5 text-[#0f9d6e]" />{c.after}</div>
            </div>
          ))}
        </div>
      </section>

      {/* PILLARS */}
      <section id="pillars" className="max-w-5xl mx-auto px-6 pb-14">
        <div className="font-mono text-[12px] tracking-[0.16em] uppercase text-[#6a4be0] mb-2">它幫你做三件事</div>
        <h2 className="text-[clamp(24px,4vw,34px)] font-black tracking-tight mb-1">做內容、找客人、看市場</h2>
        <p className="text-[#615c70] text-[15px] max-w-[56ch] mb-7">每一件都對應你真正在意的結果，工具只是手段。</p>
        <div className="grid gap-3.5 sm:grid-cols-3">
          {PILLARS.map(p => (
            <Link key={p.n} href={`/intro/features#${p.id}`} className="group flex flex-col gap-3 rounded-2xl border border-[#e6e2ee] bg-white p-5 transition-transform hover:-translate-y-1 hover:shadow-[0_16px_40px_rgba(60,40,120,0.12)]">
              <div className="flex items-center justify-between">
                <p.Icon className="h-5 w-5 text-[#6a4be0]" />
                <span className="font-mono font-extrabold text-[13px] text-[#e0479b]">{p.n}</span>
              </div>
              <h3 className="font-black text-[20px] tracking-tight">{p.title}</h3>
              <div className="text-[14px] font-medium">{p.one}</div>
              <div className="flex flex-wrap gap-1.5 pt-1">
                {p.chips.map(c => <span key={c} className="text-[11.5px] text-[#615c70] bg-[#efecf5] rounded-md px-2 py-0.5">{c}</span>)}
              </div>
              <span className="mt-auto pt-2 inline-flex items-center gap-1 text-[13px] font-bold text-[#6a4be0] group-hover:gap-2 transition-all">
                詳細說明 <ArrowRight className="h-3.5 w-3.5" />
              </span>
            </Link>
          ))}
        </div>
      </section>

      {/* KILLER */}
      <section className="relative overflow-hidden bg-[#161020] text-[#f4f0fb]">
        <div className="pointer-events-none absolute inset-x-0 h-[80%]"
          style={{ bottom: '-40%', background: 'radial-gradient(50% 100% at 70% 100%,rgba(224,71,155,.28),transparent 70%),radial-gradient(50% 100% at 20% 100%,rgba(123,92,240,.30),transparent 70%)' }} />
        <div className="relative max-w-5xl mx-auto px-6 py-14">
          <div className="font-mono text-[12px] tracking-[0.22em] uppercase text-[#ffb3da]">最強差異</div>
          <h2 className="mt-2 mb-2 text-[clamp(24px,4.4vw,38px)] font-black tracking-tight" style={BALANCE}>
            三件事串起來，<GradText>一鍵跑完</GradText>
          </h2>
          <p className="text-[#b3aac6] max-w-[54ch] mb-6">
            行銷流水線：從蒐集資料到發佈上架，整條流程自動接力，可定時排程，每一步都能用 Telegram 審核後再放行。
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
          <Link href="/intro/features#pipeline" className="mt-7 inline-flex items-center gap-1 text-[13px] font-bold text-[#c9b7ff] hover:gap-2 transition-all">
            流水線怎麼運作 <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </section>

      {/* FREE */}
      <section className="max-w-5xl mx-auto px-6 py-14">
        <div className="grid gap-6 sm:grid-cols-[1fr_1.1fr] items-center">
          <div>
            <div className="font-mono text-[12px] tracking-[0.16em] uppercase text-[#6a4be0] mb-2">先免費用，再決定</div>
            <h2 className="text-[clamp(24px,4vw,34px)] font-black tracking-tight mb-2" style={BALANCE}>註冊就能開始，不用先付錢</h2>
            <p className="text-[#615c70] text-[15px] max-w-[46ch]">先跑完一個行銷案，親眼看 AI 產出什麼，覺得值得再升級。</p>
          </div>
          <div className="rounded-2xl border border-dashed border-[#d9d3e6] bg-white p-5">
            <span className="inline-block text-[11px] font-bold tracking-wide text-[#0f9d6e] rounded-full px-2.5 py-0.5 mb-3" style={{ background: 'rgba(15,157,110,.12)' }}>免費方案包含</span>
            <ul className="space-y-2">
              {FREE_ITEMS.map(f => (
                <li key={f} className="flex gap-2 text-[14px]"><Check className="h-4 w-4 shrink-0 mt-0.5 text-[#0f9d6e]" />{f}</li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* PRICING */}
      <section className="max-w-5xl mx-auto px-6 pb-14">
        <div className="font-mono text-[12px] tracking-[0.16em] uppercase text-[#6a4be0] mb-2">方案</div>
        <div className="flex items-end justify-between flex-wrap gap-3 mb-7">
          <h2 className="text-[clamp(24px,4vw,34px)] font-black tracking-tight">從免費，到一條龍全自動</h2>
          <Link href="/intro/pricing" className="inline-flex items-center gap-1 text-[14px] font-bold text-[#6a4be0] hover:gap-2 transition-all">
            完整功能比較 <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-2xl bg-white p-5 border border-[#e6e2ee] flex flex-col">
            <div className="font-extrabold tracking-widest text-[14px]">FREE</div>
            <div className="mt-2 text-[26px] font-black">$0</div>
            <div className="text-[#615c70] text-[13px] mt-1.5">先體驗一個完整行銷案。</div>
            <span className="mt-auto pt-3 text-[11px] font-bold text-[#6a4be0]">個人試用</span>
          </div>
          {PLAN_CARDS.map(c => {
            const hi = c.plan === 'team'
            return (
              <div key={c.plan} className={`relative rounded-2xl bg-white p-5 border flex flex-col ${hi ? 'border-[#6a4be0] shadow-[inset_0_0_0_1px_#6a4be0]' : 'border-[#e6e2ee]'}`}>
                {hi && <span className="absolute -top-2.5 left-5 text-[10.5px] font-bold text-white rounded-full px-2 py-0.5" style={{ background: GRAD }}>推薦</span>}
                <div className="font-extrabold tracking-widest text-[14px]">{c.name}</div>
                <div className="mt-2 text-[26px] font-black">${c.monthlyUsd}<span className="text-[13px] font-medium text-[#938da3]"> 美元/月</span></div>
                <div className="text-[11.5px] text-[#0f9d6e] font-bold">年繳 ${c.yearlyUsd}（約 8 折）</div>
                <ul className="mt-3 space-y-1 text-[13px] text-[#615c70]">
                  {c.features.slice(0, 4).map(f => <li key={f}>· {f}</li>)}
                </ul>
                <span className="mt-auto pt-3 text-[11px] font-bold text-[#6a4be0]">
                  {c.plan === 'pro' ? '小店 / 個人品牌' : c.plan === 'team' ? '團隊 / 全自動' : '企業 / 客製'}
                </span>
              </div>
            )
          })}
        </div>
        <p className="mt-3 text-[12px] text-[#938da3]">圖片、影片、電訪、Email 等生成成本以儲值點數另計。</p>
      </section>

      {/* FAQ */}
      <section className="max-w-5xl mx-auto px-6 pb-16">
        <h2 className="text-[clamp(22px,3.6vw,30px)] font-black tracking-tight mb-5">常見問題</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {FAQ.map(f => (
            <div key={f.q} className="rounded-2xl border border-[#e6e2ee] bg-white p-5">
              <h3 className="font-extrabold text-[15px]">{f.q}</h3>
              <p className="mt-1.5 text-[13.5px] text-[#615c70]">{f.a}</p>
            </div>
          ))}
        </div>
      </section>

      <FinalCta title={<>今天就讓 AI<br />當你的行銷部。</>} />
      <IntroFooter />
    </div>
  )
}
