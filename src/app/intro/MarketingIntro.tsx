import Link from 'next/link'
import type { Metadata } from 'next'
import {
  Sparkles, Users, BarChart3, ArrowRight, Check, X, ImageIcon, FileText, Film, Target, Send, ChevronDown,
} from 'lucide-react'
import { PLAN_CARDS } from '@/lib/marketing/plan-compare'
import { GRAD, BALANCE, GradText, IntroNav, PrimaryCta, GhostCta, FinalCta, IntroFooter } from './_ui'
import { VisualStyleShowcase } from './VisualStyleShowcase'

export const marketingMetadata: Metadata = {
  title: 'AI GATE 行銷中心｜一個人就是一整個行銷部',
  description: '上傳一張產品圖，AI 寫文案、做圖、出短影音腳本、找名單、自動發送。AI GATE 行銷中心整合 11 大行銷功能與 13 項 AI 專家技能，免費開始。',
}

// 深色區塊用字：主文 #f4f0fb、次要 #ddd5ee（避免過淡看不清）
// 淺色區塊用字：主文 #17131f、次要 #3f3a4d

const HERO_OUTPUTS = [
  { Icon: Target, label: '行銷策略與切角' },
  { Icon: FileText, label: '社群貼文＋廣告文案' },
  { Icon: ImageIcon, label: '85 種風格廣告圖' },
  { Icon: Film, label: '短影音分鏡腳本' },
  { Icon: Send, label: '潛客名單＋自動寄送' },
]

const STATS = [
  { n: '11', unit: '大', label: '行銷功能一站整合' },
  { n: '13', unit: '項', label: 'AI 專家技能' },
  { n: '85', unit: '種', label: '視覺風格' },
  { n: '185', unit: '款', label: '短影音分鏡模板' },
]

const COMPARE = [
  { before: '找設計、找寫手、找剪輯，一等好幾天', after: '上傳產品圖，AI 當場產出文案與素材' },
  { before: '每天手動發文、切帳號、怕被封', after: '社群矩陣排程發文，內建防重複文案' },
  { before: '陌生開發靠人力一通一通打', after: 'AI 蒐集名單、篩選，自動電訪與寄信' },
  { before: '十幾個工具、十幾組帳密', after: '一個後台、一套點數，全部串起來' },
]

const PILLARS = [
  {
    id: 'content', n: '01', Icon: Sparkles, title: '內容，AI 幫你做', tint: 'from-[#7b5cf0] to-[#a34be0]',
    one: '上傳一張產品圖，行銷策略、文案、配圖、短影音分鏡一次產出。85 種視覺風格直接套用，不用會寫提示詞。',
    chips: ['AI 產品行銷設計師', '視覺風格與廣告創作', 'AI 視覺工坊', 'GEO 內容寫手', '13 項 AI 專家技能'],
  },
  {
    id: 'reach', n: '02', Icon: Users, title: '客人，AI 幫你找', tint: 'from-[#a34be0] to-[#e0479b]',
    one: 'AI 自動蒐集潛在客戶、篩選分類，再用電話／Email／簡訊主動聯繫；社群帳號也能矩陣化自動發文。',
    chips: ['潛在客戶行銷', 'AI 電訪', 'Email／簡訊', '社群矩陣與自動養號'],
  },
  {
    id: 'insight', n: '03', Icon: BarChart3, title: '市場，AI 幫你看', tint: 'from-[#e0479b] to-[#f0795c]',
    one: '對手在做什麼、客人在意什麼、哪種受眾最可能買單——SWOT、競品、客群模擬，決策前先看清楚。',
    chips: ['市場競品分析', '目標客群模擬', 'GEO 引用優化', '品牌資料庫'],
  },
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

function Eyebrow({ children, dark }: { children: React.ReactNode; dark?: boolean }) {
  return (
    <div className={`inline-flex items-center gap-2 font-bold text-[13px] tracking-[0.14em] uppercase mb-3 ${dark ? 'text-[#e4d9ff]' : 'text-[#5b3fd6]'}`}>
      <span className="h-[3px] w-6 rounded-full" style={{ background: GRAD }} />{children}
    </div>
  )
}

export function MarketingIntro() {
  return (
    <div className="min-h-screen bg-[#f5f3f8] text-[#17131f]">
      {/* HERO */}
      <header className="relative overflow-hidden bg-[#120c1c] text-[#f4f0fb]">
        <div className="pointer-events-none absolute inset-0"
          style={{ background: 'radial-gradient(55% 70% at 15% 0,rgba(123,92,240,.55),transparent 70%),radial-gradient(45% 60% at 95% 20%,rgba(224,71,155,.42),transparent 70%)' }} />
        <div className="pointer-events-none absolute inset-0 opacity-[0.07]"
          style={{ backgroundImage: 'linear-gradient(#fff 1px,transparent 1px),linear-gradient(90deg,#fff 1px,transparent 1px)', backgroundSize: '44px 44px' }} />
        <div className="relative max-w-6xl mx-auto px-6">
          <IntroNav />
          <div className="grid gap-12 lg:grid-cols-[1.15fr_1fr] items-center pb-16 sm:pb-20">
            <div>
              <span className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3.5 py-1.5 text-[13px] font-bold text-white">
                <span className="h-2 w-2 rounded-full bg-[#3ee6a8]" /> AI 行銷自動化平台 · 免費開始
              </span>
              <h1 className="mt-5 font-black leading-[1.04] tracking-tight text-[clamp(40px,8vw,76px)]" style={BALANCE}>
                一個人，<br />就是一整個<GradText>行銷部</GradText>。
              </h1>
              <p className="mt-6 text-[#ece6f8] text-[clamp(17px,2.4vw,21px)] leading-relaxed max-w-[44ch]">
                上傳一張產品圖，AI 寫文案、做圖、排短影音、找名單、自動發送。
                <b className="text-white">你只負責按「確認」。</b>
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <PrimaryCta>免費開始，不用先付費</PrimaryCta>
                <GhostCta href="/intro/features">看完整功能</GhostCta>
              </div>
            </div>

            {/* 產出示意卡 */}
            <div className="relative">
              <div className="absolute -inset-4 rounded-[28px] blur-2xl opacity-60" style={{ background: GRAD }} />
              <div className="relative rounded-3xl border border-white/15 bg-[#1c1429]/95 p-5 shadow-2xl">
                <div className="flex items-center gap-3 rounded-2xl border border-dashed border-white/25 bg-white/5 p-3.5">
                  <span className="grid h-12 w-12 place-items-center rounded-xl bg-white/10 text-2xl">📦</span>
                  <div>
                    <div className="text-[15px] font-bold text-white">上傳：產品照片.jpg</div>
                    <div className="text-[13px] text-[#ddd5ee]">AI 開始分析產品與市場…</div>
                  </div>
                </div>
                <div className="my-3 flex justify-center text-[#e4d9ff]"><ChevronDown className="h-5 w-5" /></div>
                <ul className="space-y-2">
                  {HERO_OUTPUTS.map(o => (
                    <li key={o.label} className="flex items-center gap-3 rounded-xl bg-white/[0.07] px-3.5 py-2.5">
                      <o.Icon className="h-4.5 w-4.5 text-[#e4d9ff] shrink-0" />
                      <span className="text-[15px] font-semibold text-white">{o.label}</span>
                      <Check className="ml-auto h-4.5 w-4.5 text-[#3ee6a8]" />
                    </li>
                  ))}
                </ul>
                <div className="mt-3 text-right text-[12px] text-[#c9bfe0]">示意畫面</div>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* STATS */}
      <section className="relative -mt-8 max-w-6xl mx-auto px-6">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {STATS.map(s => (
            <div key={s.label} className="rounded-2xl bg-white border border-[#e6e2ee] p-5 shadow-[0_10px_30px_rgba(60,40,120,0.10)]">
              <div className="text-[clamp(32px,5vw,44px)] font-black leading-none tracking-tight">
                <GradText>{s.n}</GradText><span className="ml-1 text-[18px] text-[#17131f]">{s.unit}</span>
              </div>
              <div className="mt-2 text-[15px] font-semibold text-[#3f3a4d]">{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* BEFORE / AFTER */}
      <section className="max-w-6xl mx-auto px-6 pt-20 pb-16">
        <Eyebrow>差別在哪</Eyebrow>
        <h2 className="text-[clamp(28px,4.6vw,42px)] font-black tracking-tight mb-8" style={BALANCE}>你不缺工具，你缺的是時間。</h2>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-3xl bg-[#ebe7f1] p-6">
            <div className="text-[15px] font-black text-[#3f3a4d] mb-4">以前的做法</div>
            <ul className="space-y-3">
              {COMPARE.map(c => (
                <li key={c.before} className="flex gap-3 text-[16px] text-[#3f3a4d]">
                  <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-[#d4cde0]"><X className="h-3.5 w-3.5 text-[#5a5368]" /></span>
                  <span className="line-through decoration-[#8f879f]/60">{c.before}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="relative rounded-3xl bg-white p-6 border-2 border-[#7b5cf0] shadow-[0_18px_44px_rgba(123,92,240,0.20)]">
            <div className="text-[15px] font-black mb-4"><GradText>用 AI GATE 之後</GradText></div>
            <ul className="space-y-3">
              {COMPARE.map(c => (
                <li key={c.after} className="flex gap-3 text-[16px] font-bold text-[#17131f]">
                  <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-[#0f9d6e]"><Check className="h-3.5 w-3.5 text-white" /></span>
                  {c.after}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* PILLARS */}
      <section id="pillars" className="max-w-6xl mx-auto px-6 pb-20">
        <Eyebrow>它幫你做三件事</Eyebrow>
        <h2 className="text-[clamp(28px,4.6vw,42px)] font-black tracking-tight mb-2">做內容、找客人、看市場</h2>
        <p className="text-[#3f3a4d] text-[17px] max-w-[56ch] mb-8">每一件都對應你真正在意的結果，工具只是手段。</p>
        <div className="grid gap-4 md:grid-cols-3">
          {PILLARS.map(p => (
            <Link key={p.n} href={`/intro/features#${p.id}`}
              className="group relative flex flex-col gap-4 rounded-3xl border border-[#e6e2ee] bg-white p-6 transition-all hover:-translate-y-1 hover:border-[#7b5cf0] hover:shadow-[0_20px_48px_rgba(60,40,120,0.16)]">
              <div className="flex items-center justify-between">
                <span className={`grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br ${p.tint} shadow-lg`}>
                  <p.Icon className="h-6 w-6 text-white" />
                </span>
                <span className="font-black text-[28px] text-[#ebe7f1] group-hover:text-[#d9cffb] transition-colors">{p.n}</span>
              </div>
              <h3 className="font-black text-[24px] tracking-tight">{p.title}</h3>
              <p className="text-[16px] leading-relaxed text-[#2b2635]">{p.one}</p>
              <div className="flex flex-wrap gap-1.5">
                {p.chips.map(c => <span key={c} className="text-[13px] font-semibold text-[#4a3a8c] bg-[#efeafd] rounded-lg px-2.5 py-1">{c}</span>)}
              </div>
              <span className="mt-auto pt-1 inline-flex items-center gap-1 text-[15px] font-black text-[#5b3fd6] group-hover:gap-2 transition-all">
                詳細說明 <ArrowRight className="h-4 w-4" />
              </span>
            </Link>
          ))}
        </div>
      </section>

      {/* 視覺風格與廣告創作 */}
      <VisualStyleShowcase />

      {/* KILLER */}
      <section className="relative overflow-hidden bg-[#120c1c] text-[#f4f0fb]">
        <div className="pointer-events-none absolute inset-0"
          style={{ background: 'radial-gradient(50% 80% at 80% 100%,rgba(224,71,155,.40),transparent 70%),radial-gradient(50% 80% at 10% 100%,rgba(123,92,240,.45),transparent 70%)' }} />
        <div className="relative max-w-6xl mx-auto px-6 py-20">
          <Eyebrow dark>最強差異</Eyebrow>
          <h2 className="mb-4 text-[clamp(30px,5vw,48px)] font-black tracking-tight" style={BALANCE}>
            三件事串起來，<GradText>一鍵跑完</GradText>
          </h2>
          <p className="text-[#ece6f8] text-[17px] leading-relaxed max-w-[54ch] mb-9">
            行銷流水線：從蒐集資料到發佈上架，整條流程自動接力，可定時排程，每一步都能用 Telegram 審核後再放行。
          </p>
          <ol className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-7">
            {FLOW.map((s, i) => {
              const hot = s.includes('爆款')
              return (
                <li key={s} className={`relative rounded-2xl p-4 border ${hot ? 'border-transparent' : 'border-white/15 bg-white/[0.07]'}`}
                  style={hot ? { background: GRAD } : undefined}>
                  <div className={`font-black text-[13px] ${hot ? 'text-white' : 'text-[#e4d9ff]'}`}>STEP {String(i + 1).padStart(2, '0')}</div>
                  <div className="mt-1 text-[16px] font-bold text-white">{s}</div>
                </li>
              )
            })}
          </ol>
          <Link href="/intro/features#pipeline" className="mt-9 inline-flex items-center gap-1.5 text-[16px] font-black text-white underline decoration-[#e0479b] decoration-2 underline-offset-4 hover:gap-2.5 transition-all">
            流水線怎麼運作 <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>

      {/* FREE */}
      <section className="max-w-6xl mx-auto px-6 py-20">
        <div className="grid gap-8 md:grid-cols-[1fr_1.1fr] items-center rounded-3xl bg-gradient-to-br from-[#eafaf3] to-white border border-[#bfead8] p-7 sm:p-10">
          <div>
            <div className="inline-flex items-center gap-2 font-bold text-[13px] tracking-[0.14em] uppercase mb-3 text-[#0b7a55]">
              <span className="h-[3px] w-6 rounded-full bg-[#0f9d6e]" />先免費用，再決定
            </div>
            <h2 className="text-[clamp(28px,4.4vw,40px)] font-black tracking-tight mb-3" style={BALANCE}>註冊就能開始，<br />不用先付錢</h2>
            <p className="text-[#2b3a33] text-[17px] max-w-[40ch] mb-6">先跑完一個行銷案，親眼看 AI 產出什麼，覺得值得再升級。</p>
            <PrimaryCta>立即免費註冊</PrimaryCta>
          </div>
          <ul className="space-y-3">
            {FREE_ITEMS.map(f => (
              <li key={f} className="flex gap-3 rounded-2xl bg-white border border-[#d7efe4] px-4 py-3.5 text-[16px] font-semibold text-[#17131f]">
                <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-[#0f9d6e]"><Check className="h-3.5 w-3.5 text-white" /></span>
                {f}
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* PRICING */}
      <section className="max-w-6xl mx-auto px-6 pb-20">
        <Eyebrow>方案</Eyebrow>
        <div className="flex items-end justify-between flex-wrap gap-3 mb-8">
          <h2 className="text-[clamp(28px,4.6vw,42px)] font-black tracking-tight">從免費，到一條龍全自動</h2>
          <Link href="/intro/pricing" className="inline-flex items-center gap-1.5 rounded-xl border-2 border-[#5b3fd6] px-4 py-2 text-[15px] font-black text-[#5b3fd6] hover:bg-[#5b3fd6] hover:text-white transition-colors">
            完整功能比較 <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-3xl bg-white p-6 border border-[#e6e2ee] flex flex-col">
            <div className="font-black tracking-widest text-[15px]">FREE</div>
            <div className="mt-3 text-[36px] font-black leading-none">$0</div>
            <div className="mt-1 text-[14px] text-[#3f3a4d]">永久免費</div>
            <div className="text-[#2b2635] text-[15px] mt-4">先體驗一個完整行銷案。</div>
            <span className="mt-auto pt-4 text-[13px] font-black text-[#5b3fd6]">個人試用</span>
          </div>
          {PLAN_CARDS.map(c => {
            const hi = c.plan === 'team'
            return (
              <div key={c.plan} className={`relative rounded-3xl p-6 flex flex-col ${hi ? 'text-white shadow-[0_20px_48px_rgba(123,92,240,0.35)]' : 'bg-white border border-[#e6e2ee]'}`}
                style={hi ? { background: 'linear-gradient(160deg,#2a1a4a,#4b2378 60%,#7a2a6b)' } : undefined}>
                {hi && <span className="absolute -top-3 left-6 text-[12px] font-black text-white rounded-full px-3 py-1" style={{ background: GRAD }}>推薦</span>}
                <div className="font-black tracking-widest text-[15px]">{c.name}</div>
                <div className="mt-3 text-[36px] font-black leading-none">${c.monthlyUsd}<span className={`text-[14px] font-semibold ${hi ? 'text-[#ece6f8]' : 'text-[#3f3a4d]'}`}> 美元/月</span></div>
                <div className={`mt-1 text-[13px] font-bold ${hi ? 'text-[#7ff0c4]' : 'text-[#0b7a55]'}`}>年繳 ${c.yearlyUsd}（約 8 折）</div>
                <ul className={`mt-4 space-y-1.5 text-[15px] ${hi ? 'text-[#f4f0fb]' : 'text-[#2b2635]'}`}>
                  {c.features.slice(0, 4).map(f => (
                    <li key={f} className="flex gap-2"><Check className={`h-4 w-4 shrink-0 mt-0.5 ${hi ? 'text-[#7ff0c4]' : 'text-[#0f9d6e]'}`} />{f}</li>
                  ))}
                </ul>
                <span className={`mt-auto pt-4 text-[13px] font-black ${hi ? 'text-[#f0c6ff]' : 'text-[#5b3fd6]'}`}>
                  {c.plan === 'pro' ? '小店 / 個人品牌' : c.plan === 'team' ? '團隊 / 全自動' : '企業 / 客製'}
                </span>
              </div>
            )
          })}
        </div>
        <p className="mt-4 text-[14px] text-[#3f3a4d]">圖片、影片、電訪、Email 等生成成本以儲值點數另計。</p>
      </section>

      {/* FAQ */}
      <section className="max-w-3xl mx-auto px-6 pb-20">
        <h2 className="text-[clamp(26px,4vw,36px)] font-black tracking-tight mb-6 text-center">常見問題</h2>
        <div className="space-y-3">
          {FAQ.map(f => (
            <details key={f.q} className="group rounded-2xl border border-[#e6e2ee] bg-white px-5 py-4 open:border-[#7b5cf0]">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-[17px] font-black">
                {f.q}
                <ChevronDown className="h-5 w-5 shrink-0 text-[#5b3fd6] transition-transform group-open:rotate-180" />
              </summary>
              <p className="mt-3 text-[16px] leading-relaxed text-[#2b2635]">{f.a}</p>
            </details>
          ))}
        </div>
      </section>

      <FinalCta title={<>今天就讓 AI<br />當你的行銷部。</>} />
      <IntroFooter />
    </div>
  )
}
