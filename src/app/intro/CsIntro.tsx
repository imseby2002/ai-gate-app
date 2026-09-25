import Link from 'next/link'
import type { Metadata } from 'next'
import {
  Inbox, Sparkles, Languages, ShoppingCart, ShieldCheck, Moon, Repeat, Layers,
  MessageCircle, Brain, UserCheck, ArrowRight, Lock, Clock, Calculator, Check,
} from 'lucide-react'
import { CS_GRAD, BALANCE, CsGradText, CsNav, CsPrimaryCta, CsGhostCta, CsGlow, CsFinalCta, CsFooter, SectionHead } from './_cs/ui'
import { CS_PLANS, PLAN_NAME, PLAN_FIT, planPrice } from './_cs/data'

export const csMetadata: Metadata = {
  title: 'IMT 智能客服｜半夜的客人，AI 幫你接',
  description: 'LINE、WhatsApp、Messenger、Instagram、Telegram、Zalo、WeChat 訊息集中一個收件匣，AI 自動回覆、查訂單、開工單。不限訊息則數，免費方案即可開始。',
}

const PLATFORMS = [
  { name: 'LINE OA', color: '#00B900' },
  { name: 'WhatsApp Business', color: '#25D366' },
  { name: 'WhatsApp 個人版', color: '#128C7E' },
  { name: 'Messenger', color: '#0084FF' },
  { name: 'Instagram', color: '#E1306C' },
  { name: 'Telegram', color: '#2AABEE' },
  { name: 'Zalo OA', color: '#0068FF' },
  { name: 'WeChat', color: '#07C160' },
]

const STATS = [
  { v: '不限', l: 'AI 回覆則數，免費版也一樣' },
  { v: `${PLATFORMS.length}`, l: '個通訊平台可串接' },
  { v: '6', l: '種行業模板一鍵套用' },
  { v: '$0', l: '免費方案即可開始' },
]

const PAINS = [
  { Icon: Moon, pain: '半夜 11 點，客人問入住密碼', fix: 'AI 查訂單、核對身份，到入住時間才給密碼，你繼續睡。' },
  { Icon: Repeat, pain: '「幾點入住？」一天被問 30 次', fix: '寫進知識庫一次，AI 用客人的語言回答每一次。' },
  { Icon: Layers, pain: '訊息散在 LINE、WhatsApp、IG', fix: '全部進同一個收件匣，AI 先回，你隨時接手。' },
]

const FLOW = [
  { Icon: MessageCircle, t: '客人傳訊息', d: '任何平台、任何語言' },
  { Icon: Brain, t: 'AI 判斷意圖', d: '問價、查單、要真人…' },
  { Icon: ShoppingCart, t: '查資料再回答', d: '知識庫、訂單、試算表' },
  { Icon: UserCheck, t: '需要真人才找你', d: '自動開工單、推播通知' },
]

const HIGHLIGHTS = [
  { Icon: Inbox, t: '統一收件匣', d: '所有平台對話集中一處，一鍵切換 AI 自動回覆或真人接管，手機可安裝成 App。' },
  { Icon: ShoppingCart, t: '訂單查詢', d: '搭配 IMT 訂房系統，客人給訂單號碼、姓名或手機就能查入住資訊；Trip、KKday 等單號對不上的平台改用姓名比對。' },
  { Icon: Sparkles, t: '意圖識別＋工單', d: '要求真人、問訂金尾款、查無訂單等情境自動開工單，LINE／Telegram 通知負責人。' },
  { Icon: Languages, t: '多語言自動切換', d: '客人用中、英、越、日、韓文問，AI 用同一種語言回。' },
  { Icon: Calculator, t: '報價計算機', d: '平假日價、連假、團體折扣設定好，AI 照公式算錢，不會自己亂報。' },
  { Icon: Brain, t: '看圖回覆', d: '客人傳訂單截圖、照片，AI 看得懂，複雜問題自動交給更強的模型。' },
]

const GUARDS = [
  { Icon: Lock, t: '查不到就說查不到', d: '系統沒有比對到訂單時，AI 一律不提供、不推測任何密碼或房號。' },
  { Icon: Clock, t: '入住時間前不給密碼', d: '還沒到你設定的入住時間，AI 只會告知幾點後再查詢。' },
  { Icon: UserCheck, t: '姓名先核對再放行', d: '姓名不是逐字對上時，先請客人確認「是不是某某某」，確認後才給密碼。' },
  { Icon: ShieldCheck, t: '高風險交給更謹慎的模型', d: '退換貨、客訴、法律類問題自動升級給 Claude 處理。' },
]

const INDUSTRIES = ['民宿／旅遊', '電商／零售', '餐廳／餐飲', '診所／醫美', '美容／美髮／SPA', '教育／補習班']

const FAQ = [
  { q: '免費版真的也不限回答數量？', a: '是。FREE 到 MAX 所有方案 AI 回覆都不限則數，對話量再大價格都固定，不會因為用量爆表被加價。方案差別只在平台數、協作人數與進階功能。' },
  { q: '不會設定怎麼辦？', a: '後台有一步步的設定教學；也可以直接按「找人幫我設定」由我們代為串接。PRO 每月 1 次、MAX 每月 2 次免費，新升級 CORE 首次免費。' },
  { q: 'AI 回錯了怎麼辦？', a: '在「AI 回答修正」貼上情境、錯誤回覆與正確做法，送出後立即生效，AI 之後遇到類似情境會照規則回答。' },
  { q: '可以隨時由真人接手嗎？', a: '可以。收件匣裡每個對話都能切換「AI 自動回覆」或「真人接管」。' },
]

export function CsIntro() {
  return (
    <div className="min-h-screen bg-[#f3f6f8] text-[#0f1720]">
      {/* HERO */}
      <header className="relative overflow-hidden bg-[#0b1620] text-[#eef5f8]">
        <CsGlow className="-top-1/3" />
        <div className="relative max-w-5xl mx-auto px-6">
          <CsNav />
          <div className="grid gap-10 lg:grid-cols-[1.1fr_.9fr] items-center pb-16 sm:pb-20">
            <div>
              <div className="font-mono text-[12px] tracking-[0.22em] uppercase text-[#7fe0db]">AI 智能客服 · 24 小時不打烊</div>
              <h1 className="mt-4 font-black leading-[1.04] tracking-tight text-[clamp(36px,7.5vw,64px)]" style={BALANCE}>
                半夜的客人，<br /><CsGradText>AI 幫你接。</CsGradText>
              </h1>
              <p className="mt-5 text-[#9fb3bf] text-[clamp(16px,2.3vw,19px)] max-w-[44ch]">
                LINE、WhatsApp、IG 的訊息全部進同一個收件匣。AI 查訂單、報價、回答常見問題，真的需要你時才通知你。
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <CsPrimaryCta />
                <CsGhostCta href="/intro/pricing">看方案價格</CsGhostCta>
              </div>
              <p className="mt-4 text-[12.5px] text-[#7f96a3]">免費方案不限訊息則數 · 30 分鐘內上線</p>
            </div>

            {/* 對話示意 */}
            <div className="relative">
              <div className="absolute -inset-4 rounded-[28px] opacity-60 blur-2xl" style={{ background: CS_GRAD }} />
              <div className="relative rounded-3xl border border-[#1f3140] bg-[#0f1f2b] p-4 shadow-2xl">
                <div className="flex items-center gap-2 pb-3 border-b border-[#1f3140]">
                  <span className="w-2 h-2 rounded-full bg-[#00B900]" />
                  <span className="text-[12.5px] font-bold">LINE · 晨光民宿</span>
                  <span className="ml-auto text-[11px] text-[#7f96a3] font-mono">23:48</span>
                </div>
                <div className="space-y-2.5 pt-3 text-[13px] leading-relaxed">
                  <div className="max-w-[80%] rounded-2xl rounded-tl-md bg-[#1b2e3c] px-3 py-2">不好意思，我們快到了，門口密碼是多少？</div>
                  <div className="ml-auto max-w-[82%] rounded-2xl rounded-tr-md px-3 py-2 text-white" style={{ background: CS_GRAD }}>
                    您好！麻煩提供訂單編號、訂房姓名或手機號碼，我馬上幫您查 🙏
                  </div>
                  <div className="max-w-[80%] rounded-2xl rounded-tl-md bg-[#1b2e3c] px-3 py-2">0912-345-678</div>
                  <div className="ml-auto max-w-[82%] rounded-2xl rounded-tr-md px-3 py-2 text-white" style={{ background: CS_GRAD }}>
                    找到了，陳小姐今晚入住「海景雙人房」<br />大門密碼 ****＃，房門密碼 ****＃<br />路上小心，祝您入住愉快！
                  </div>
                </div>
                <div className="mt-3 flex items-center gap-2 text-[11px] text-[#7fe0db]">
                  <Check className="h-3.5 w-3.5" /> AI 已比對訂單並確認入住時間
                </div>
              </div>
              <p className="mt-2 text-right text-[11px] text-[#5f7684]">對話示意</p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 pb-10">
            {PLATFORMS.map(p => (
              <span key={p.name} className="inline-flex items-center gap-1.5 text-[12.5px] rounded-full px-3 py-1 border border-[#1f3140] bg-white/5 text-[#cfdde5]">
                <span className="w-1.5 h-1.5 rounded-full" style={{ background: p.color }} />{p.name}
              </span>
            ))}
          </div>
        </div>
      </header>

      {/* FREE 不限則數 */}
      <div className="relative overflow-hidden text-white" style={{ background: CS_GRAD }}>
        <div className="max-w-5xl mx-auto px-6 py-6 sm:py-7 flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-6">
          <div className="shrink-0 font-black leading-none text-[clamp(26px,5vw,40px)] tracking-tight">免費版也不限則數</div>
          <div className="text-[14px] sm:text-[15px] text-white/90 leading-relaxed">
            市場常見的 AI 客服免費版每月只給 50–100 則，用完就停、想繼續就加價。
            這裡 <b className="text-white">FREE 方案 AI 回答數量不設上限</b>，客人問幾次、AI 就回幾次，一毛不用多付。
          </div>
          <Link href="/register" className="sm:ml-auto shrink-0 self-start sm:self-center inline-flex items-center gap-1.5 font-bold text-[14px] rounded-xl bg-white text-[#1d4ed8] px-4 py-2 hover:bg-white/90">
            免費開始 <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>

      {/* STATS */}
      <div className="border-b border-[#dde5ea] bg-white">
        <div className="max-w-5xl mx-auto px-6 py-7 grid grid-cols-2 sm:grid-cols-4 gap-5">
          {STATS.map(s => (
            <div key={s.l}>
              <div className="text-[clamp(26px,4.5vw,36px)] font-black tracking-tight"><CsGradText>{s.v}</CsGradText></div>
              <div className="text-[13px] text-[#56646d]">{s.l}</div>
            </div>
          ))}
        </div>
      </div>

      {/* PAIN → FIX */}
      <section className="max-w-5xl mx-auto px-6 py-14">
        <SectionHead eyebrow="你一定遇過" title="客服最累的，都是重複又不能不回的事" sub="這些事交給 AI，你只處理真正需要人的那幾件。" />
        <div className="grid gap-3.5 sm:grid-cols-3">
          {PAINS.map(p => (
            <div key={p.pain} className="rounded-2xl border border-[#dde5ea] bg-white p-5 transition-transform hover:-translate-y-1 hover:shadow-[0_16px_40px_rgba(15,60,90,0.10)]">
              <p.Icon className="h-5 w-5 text-[#e05a47]" />
              <div className="mt-3 font-black text-[17px] leading-snug">{p.pain}</div>
              <div className="mt-3 pt-3 border-t border-dashed border-[#dde5ea] flex gap-2 text-[14px] text-[#3d4a52]">
                <ArrowRight className="h-4 w-4 mt-0.5 shrink-0 text-[#0d8f8e]" />{p.fix}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section className="relative overflow-hidden bg-[#0b1620] text-[#eef5f8]">
        <CsGlow className="-top-1/2" />
        <div className="relative max-w-5xl mx-auto px-6 py-14">
          <div className="font-mono text-[12px] tracking-[0.22em] uppercase text-[#7fe0db]">運作方式</div>
          <h2 className="mt-2 mb-8 text-[clamp(24px,4.4vw,38px)] font-black tracking-tight" style={BALANCE}>
            AI 先回，<CsGradText>該你出場才叫你</CsGradText>
          </h2>
          <div className="grid gap-3 sm:grid-cols-4">
            {FLOW.map((s, i) => (
              <div key={s.t} className="relative rounded-2xl border border-[#1f3140] bg-[#101f2b] p-4">
                <span className="font-mono text-[11px] font-bold text-[#7fe0db]">{String(i + 1).padStart(2, '0')}</span>
                <s.Icon className="h-5 w-5 mt-2 text-[#cfdde5]" />
                <div className="mt-2 font-extrabold">{s.t}</div>
                <div className="text-[13px] text-[#9fb3bf]">{s.d}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* HIGHLIGHTS */}
      <section className="max-w-5xl mx-auto px-6 py-14">
        <SectionHead eyebrow="主要功能" title="一個後台，接住所有客人" />
        <div className="mt-6 grid gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
          {HIGHLIGHTS.map(f => (
            <div key={f.t} className="rounded-2xl border border-[#dde5ea] bg-white p-5">
              <span className="grid place-items-center w-9 h-9 rounded-xl text-white" style={{ background: CS_GRAD }}><f.Icon className="h-4.5 w-4.5" /></span>
              <h3 className="mt-3 font-black text-[17px]">{f.t}</h3>
              <p className="mt-1 text-[14px] text-[#3d4a52]">{f.d}</p>
            </div>
          ))}
        </div>
        <Link href="/intro/features" className="mt-6 inline-flex items-center gap-1.5 font-bold text-[14px] text-[#0d8f8e] hover:underline">
          看完整功能 <ArrowRight className="h-4 w-4" />
        </Link>
      </section>

      {/* GUARDS */}
      <section className="border-y border-[#dde5ea] bg-white">
        <div className="max-w-5xl mx-auto px-6 py-14">
          <SectionHead eyebrow="放心交給 AI" title={<>AI 客服最怕亂講。<br />我們把「不能亂講」寫進系統。</>} sub="密碼、房號、價格這種講錯就出事的資訊，一律以系統資料為準。" />
          <div className="grid gap-3 sm:grid-cols-2">
            {GUARDS.map(g => (
              <div key={g.t} className="flex gap-3 rounded-2xl bg-[#f3f6f8] p-4">
                <g.Icon className="h-5 w-5 shrink-0 text-[#0d8f8e]" />
                <div>
                  <div className="font-extrabold">{g.t}</div>
                  <div className="text-[13.5px] text-[#56646d]">{g.d}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* INDUSTRIES */}
      <section className="max-w-5xl mx-auto px-6 py-14">
        <SectionHead eyebrow="行業模板" title="選你的行業，一鍵套用" sub="AI 自動配置系統提示詞與預訂流程，也可以跳過直接自訂。" />
        <div className="flex flex-wrap gap-2">
          {INDUSTRIES.map(i => (
            <span key={i} className="rounded-xl border border-[#dde5ea] bg-white px-4 py-2 font-bold text-[14px]">{i}</span>
          ))}
        </div>
      </section>

      {/* PRICING TEASER */}
      <section className="max-w-5xl mx-auto px-6 pb-14">
        <SectionHead eyebrow="方案價格" title="不按則數收費，用越多越划算" sub="美金計價，年繳約省 2 成。" />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {CS_PLANS.map(p => (
            <div key={p} className={`rounded-2xl bg-white p-5 border ${p === 'core' ? 'border-[#2563eb] shadow-[inset_0_0_0_1px_#2563eb]' : 'border-[#dde5ea]'}`}>
              <div className="flex items-center justify-between">
                <span className="font-extrabold tracking-widest text-[14px]">{PLAN_NAME[p]}</span>
                {p === 'core' && <span className="text-[11px] font-bold text-white rounded-full px-2 py-0.5" style={{ background: CS_GRAD }}>推薦</span>}
              </div>
              <div className="mt-2"><span className="text-[30px] font-black">${planPrice(p, 'monthly')}</span><span className="text-[13px] text-[#56646d]"> /月</span></div>
              <div className="text-[13px] text-[#56646d] mt-1">{PLAN_FIT[p]}</div>
            </div>
          ))}
        </div>
        <Link href="/intro/pricing" className="mt-6 inline-flex items-center gap-1.5 font-bold text-[14px] text-[#0d8f8e] hover:underline">
          看各方案功能比較 <ArrowRight className="h-4 w-4" />
        </Link>
      </section>

      {/* FAQ */}
      <section className="max-w-5xl mx-auto px-6 pb-16">
        <SectionHead eyebrow="常見問題" title="開始之前" />
        <div className="grid gap-3 sm:grid-cols-2">
          {FAQ.map(f => (
            <div key={f.q} className="rounded-2xl border border-[#dde5ea] bg-white p-5">
              <div className="font-extrabold">{f.q}</div>
              <p className="mt-1.5 text-[14px] text-[#3d4a52]">{f.a}</p>
            </div>
          ))}
        </div>
      </section>

      <CsFinalCta title={<>今晚開始，<br />讓 AI 幫你顧客服。</>} sub="免費方案即可串接 3 個平台，不限訊息則數。" />
      <CsFooter />
    </div>
  )
}
