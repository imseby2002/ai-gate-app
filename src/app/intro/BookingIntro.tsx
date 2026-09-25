import Link from 'next/link'
import type { Metadata } from 'next'
import {
  BedDouble, Globe, Zap, Tag, Percent, LayoutGrid, ClipboardList, Mail, Star, BarChart2,
  Download, Headphones, ArrowRight, Shield, Check,
} from 'lucide-react'

export const bookingMetadata: Metadata = {
  title: 'IMT 智能訂房系統｜民宿官網、訂單、定價與通路同步一站搞定',
  description: 'AI 設計民宿官網、線上訂房、空房表、動態定價、優惠碼，iCal / Email / 即時同步 60+ 平台防超賣。免費方案即可開始。',
}

// 內容對齊 /booking 各功能頁與 /booking/plan 方案內容，只列「已上線」功能
const CHANNELS = ['Booking.com', 'Agoda', 'Airbnb', 'Expedia', 'Trip.com', '60+ 平台']

const FEATURES = [
  { Icon: Globe, title: 'AI 設計官網', desc: '對 AI 說想要的風格，自動生成民宿官網，電腦、手機版即時預覽，旅客直接線上訂房。' },
  { Icon: Zap, title: '即時同步 60+ 平台', desc: '房況秒級同步各大訂房平台，一邊訂出、其他通路立即關房，避免超賣。' },
  { Icon: Mail, title: 'Email / iCal 同步', desc: '連接信箱自動解析平台訂房確認信轉成訂單；iCal 每小時匯入，作為備援。' },
  { Icon: LayoutGrid, title: '空房表與日曆', desc: '一張表看所有房間的可訂、已訂、關閉狀態，拖曳訂單就能換房、改期。' },
  { Icon: Tag, title: '動態定價規則', desc: '週末、假日、季節、住房率、早鳥、臨時訂等規則自動調價，還能周邊比價。' },
  { Icon: Percent, title: '折扣與優惠碼', desc: '建立折扣碼，旅客在官網訂房時直接套用。' },
  { Icon: ClipboardList, title: '每日入住', desc: '今天誰入住、住哪間、房門密碼與旅客資訊一頁列清楚。' },
  { Icon: Star, title: '通知信與評價', desc: '通知信模板一鍵寄給旅客；集中管理各平台評價，追蹤平均分與回覆率。' },
  { Icon: BarChart2, title: '數據報表', desc: '交易額、平均房價、住房率、各通路與各房型分析，可匯出 CSV。' },
  { Icon: Download, title: '一鍵匯入', desc: '將 Booking.com / Agoda 等平台上的民宿資料一鍵匯入，不用重新建檔。' },
  { Icon: Headphones, title: '串接 AI 客服', desc: '與 IMT 智能客服連動，旅客問訂單、入住資訊由 AI 直接查詢回覆。' },
]

const PLANS = [
  { name: 'FREE', price: 0, highlight: false, items: ['1 房源（不可加購）', '官網 AI 設計', 'iCal 同步'] },
  { name: 'CORE', price: 8, highlight: false, items: ['5 房源（+$4/房源）', '1 位協作者', '動態定價規則', '優惠碼', 'Email 同步（OTA 信件轉單）'] },
  { name: 'PRO', price: 29, highlight: true, items: ['5 房源（+$3/房源）', '2 位協作者', '即時同步 60+ 平台（秒級防超賣）', '與 CS 串接（訂單密碼連動）', '每月 1 次免費協助設定'] },
  { name: 'MAX', price: 49, highlight: false, items: ['15 房源（+$2/房源）', '無上限協作者', '動態定價客製規則', '優惠碼', '每月 2 次免費協助設定'] },
]

const GRAD = 'linear-gradient(100deg,#f59e0b,#ef4444 50%,#6366f1)'
const BALANCE = { textWrap: 'balance' } as React.CSSProperties

function GradText({ children }: { children: React.ReactNode }) {
  return <span style={{ background: GRAD, WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent' }}>{children}</span>
}

function PrimaryCta() {
  return (
    <Link href="/register" className="inline-flex items-center gap-2 font-bold text-[15px] px-6 py-3 rounded-xl text-white transition-transform hover:-translate-y-0.5"
      style={{ background: GRAD, boxShadow: '0 10px 26px rgba(239,68,68,.30)' }}>
      免費開始 <ArrowRight className="h-4 w-4" />
    </Link>
  )
}

export function BookingIntro() {
  return (
    <div className="min-h-screen bg-[#f7f5f2] text-[#1a1612]">
      {/* HERO */}
      <header className="relative overflow-hidden bg-[#17120f] text-[#f7f1ea]">
        <div
          className="pointer-events-none absolute -top-1/3 inset-x-0 h-[70%]"
          style={{ background: 'radial-gradient(60% 100% at 25% 0,rgba(245,158,11,.34),transparent 70%),radial-gradient(50% 100% at 85% 10%,rgba(99,102,241,.32),transparent 70%)' }}
        />
        <div className="relative max-w-5xl mx-auto px-6">
          <nav className="flex items-center gap-3 pt-6 pb-10">
            <span className="grid place-items-center w-8 h-8 rounded-lg text-white shrink-0" style={{ background: GRAD }}>
              <BedDouble className="h-4 w-4" />
            </span>
            <b className="font-black tracking-wide">IMT 智能訂房系統</b>
            <Link href="/login" className="ml-auto text-[13px] text-[#b9ab9c] hover:text-white">登入</Link>
          </nav>

          <div className="pb-16 sm:pb-20">
            <div className="font-mono text-[12px] tracking-[0.22em] uppercase text-[#fcc97a]">民宿 · 旅宿 PMS</div>
            <h1 className="mt-4 font-black leading-[1.05] tracking-tight text-[clamp(36px,8vw,68px)]" style={BALANCE}>
              官網、訂單、房價，<br />
              <GradText>一個後台</GradText>全搞定。
            </h1>
            <p className="mt-5 text-[#b9ab9c] text-[clamp(16px,2.4vw,20px)] max-w-[50ch]">
              AI 幫你做好民宿官網，旅客直接線上訂房；各平台訂單自動匯入同一張空房表，房況即時同步不超賣。
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <PrimaryCta />
              <a href="#features" className="inline-flex items-center gap-2 font-bold text-[15px] px-6 py-3 rounded-xl text-[#f7f1ea] border border-[#3a2f27] bg-white/5 transition-transform hover:-translate-y-0.5">
                看它能做什麼
              </a>
            </div>
            <div className="mt-9 flex flex-wrap gap-2">
              {CHANNELS.map(c => (
                <span key={c} className="inline-flex items-center gap-1.5 text-[12.5px] rounded-full px-3 py-1 border border-[#3a2f27] bg-white/5 text-[#e5d9cc]">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#f59e0b]" />{c}
                </span>
              ))}
            </div>
          </div>
        </div>
      </header>

      {/* HOOK */}
      <div className="border-b border-[#e7e1d9]">
        <div className="max-w-5xl mx-auto px-6 py-7">
          <p className="text-[clamp(17px,2.6vw,22px)] font-medium leading-snug" style={BALANCE}>
            別再手動對帳、開好幾個後台關房。
            <span className="text-[#8a7d70]"> 訂單集中、房況同步、價格自動調整，把時間留給旅客。</span>
          </p>
        </div>
      </div>

      {/* FEATURES */}
      <section id="features" className="max-w-5xl mx-auto px-6 py-14">
        <div className="font-mono text-[12px] tracking-[0.16em] uppercase text-[#c2410c] mb-2">已上線功能</div>
        <h2 className="text-[clamp(24px,4vw,34px)] font-black tracking-tight mb-1">從接單到入住，一條龍</h2>
        <p className="text-[#5f554c] text-[15px] max-w-[56ch] mb-7">民宿設定、訂單管理、旅客互動、數據與同步，都在同一個工作台。</p>
        <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map(f => (
            <div key={f.title} className="flex flex-col gap-2.5 rounded-2xl border border-[#e7e1d9] bg-white p-5 transition-transform hover:-translate-y-1 hover:shadow-[0_16px_40px_rgba(80,50,20,0.10)]">
              <f.Icon className="h-5 w-5 text-[#c2410c]" />
              <h3 className="font-black text-[18px] tracking-tight">{f.title}</h3>
              <p className="text-[14px] text-[#4a4038]">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* PRICING */}
      <section className="relative overflow-hidden bg-[#17120f] text-[#f7f1ea]">
        <div className="pointer-events-none absolute inset-x-0 h-[80%]"
          style={{ bottom: '-40%', background: 'radial-gradient(50% 100% at 70% 100%,rgba(99,102,241,.26),transparent 70%),radial-gradient(50% 100% at 20% 100%,rgba(245,158,11,.24),transparent 70%)' }} />
        <div className="relative max-w-5xl mx-auto px-6 py-14">
          <div className="font-mono text-[12px] tracking-[0.22em] uppercase text-[#fcc97a]">方案價格</div>
          <h2 className="mt-2 mb-2 text-[clamp(24px,4.4vw,38px)] font-black tracking-tight" style={BALANCE}>
            依房源數選方案，<GradText>免費就能開始</GradText>
          </h2>
          <p className="text-[#b9ab9c] max-w-[54ch] mb-7">美元計價，年繳限時 7 折；付款後立即生效，不自動續訂。</p>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {PLANS.map(p => (
              <div key={p.name} className={`relative rounded-2xl border p-5 ${p.highlight ? 'border-[#f59e0b] bg-[#241a12]' : 'border-[#3a2f27] bg-[#1f1813]'}`}>
                {p.highlight && <span className="absolute -top-2.5 right-4 text-[11px] font-bold px-2 py-0.5 rounded-full text-white" style={{ background: GRAD }}>推薦</span>}
                <div className="font-mono text-[13px] tracking-widest text-[#e5d9cc]">{p.name}</div>
                <div className="mt-2 mb-4">
                  <span className="text-[34px] font-black">${p.price}</span>
                  <span className="text-[13px] text-[#b9ab9c]"> 美元/月</span>
                </div>
                <ul className="space-y-1.5">
                  {p.items.map(i => (
                    <li key={i} className="flex gap-2 text-[13px] text-[#e5d9cc]">
                      <Check className="h-4 w-4 shrink-0 mt-0.5 text-[#f59e0b]" />{i}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FINAL CTA */}
      <section className="max-w-5xl mx-auto px-6 py-16 text-center">
        <div className="font-mono text-[12px] tracking-[0.22em] uppercase text-[#c2410c]">準備好了嗎</div>
        <h2 className="mt-3 mb-6 text-[clamp(26px,5vw,42px)] font-black tracking-tight" style={BALANCE}>
          今天就開好你的<br />民宿官網與訂房系統。
        </h2>
        <div className="flex flex-wrap gap-3 justify-center">
          <PrimaryCta />
          <Link href="/login" className="inline-flex items-center gap-2 font-bold text-[15px] px-6 py-3 rounded-xl text-[#1a1612] border border-[#d9d0c5] bg-white transition-transform hover:-translate-y-0.5">
            我已有帳號
          </Link>
        </div>
        <p className="mt-4 text-[12px] text-[#8a7d70] inline-flex items-center gap-1">
          <Shield className="h-3.5 w-3.5" /> FREE 方案永久免費・資料加密保護
        </p>
      </section>

      <footer className="text-center text-[#8a7d70] text-[12px] py-7 border-t border-[#e7e1d9] flex items-center justify-center gap-3 flex-wrap">
        <span className="flex items-center gap-2"><BedDouble className="h-3.5 w-3.5" /> IMT 智能訂房系統 · booking.im-tourist.com</span>
        <Link href="/privacy" className="hover:text-[#4a4038]">隱私權政策</Link>
      </footer>
    </div>
  )
}
