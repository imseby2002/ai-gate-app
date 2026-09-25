import Link from 'next/link'
import type { Metadata } from 'next'
import {
  Headphones, Sparkles, Languages, ShoppingCart, Ticket, Inbox, Calculator,
  ArrowRight, Shield, UserRound,
} from 'lucide-react'

export const csMetadata: Metadata = {
  title: 'IMT 智能客服｜24 小時不打烊的 AI 客服',
  description: 'LINE、WhatsApp、Telegram、Zalo、WeChat 多平台對話集中一個收件匣，AI 自動回覆、查訂單、開工單。不限則數，方案價格固定。',
}

// 內容對齊 /cs/about（CsAbout）與 CsLanding 的既有功能說明，只列「已上線」功能
const PLATFORMS = [
  { name: 'LINE OA', color: '#00B900' },
  { name: 'WhatsApp Business', color: '#25D366' },
  { name: 'WhatsApp Personal', color: '#128C7E' },
  { name: 'Telegram', color: '#2AABEE' },
  { name: 'Zalo OA', color: '#0068FF' },
  { name: 'WeChat', color: '#07C160' },
]

const FEATURES = [
  { Icon: Inbox, title: '統一收件匣', desc: 'LINE / WhatsApp / Telegram / Zalo 等多平台對話集中一個後台管理，手機也能裝成 App 用。' },
  { Icon: Sparkles, title: '意圖識別', desc: '偵測客人要求轉真人、訂金/餘款詢問、查無訂單等情境，自動建立工單通知專員，不怕漏接。' },
  { Icon: Languages, title: '多語言自動偵測', desc: '自動偵測客戶語言並切換回覆（中/英/越/日/韓等）。' },
  { Icon: ShoppingCart, title: '訂單查詢串接', desc: '民宿訂房業者可用訂單號碼、姓名或手機直接查詢入住資訊，不用轉人工核對。' },
  { Icon: Ticket, title: '工單系統', desc: '複雜問題轉工單追蹤，並可透過 LINE / Telegram / webhook 通知負責人。' },
  { Icon: Calculator, title: '定價計算機', desc: 'AI 自動套公式計算並告知客戶報價。' },
  { Icon: UserRound, title: '客戶摘要', desc: '自動整理回頭客背景，客服接手對話時在收件匣直接看到。' },
]

const INDUSTRIES = [
  { name: '民宿 / 旅遊', tags: ['房型預訂', '日期選擇', '退訂政策', '行程推薦'] },
  { name: '電商 / 零售', tags: ['訂單狀態', '退換貨', '物流追蹤', '商品諮詢'] },
  { name: '餐廳 / 餐飲', tags: ['線上訂位', '菜單查詢', '外送時間', '包廂服務'] },
  { name: '診所 / 醫美', tags: ['線上預約', '療程說明', '費用查詢', '術後問題'] },
  { name: '美容 / 美髮 / SPA', tags: ['服務預約', '設計師選擇', '價格諮詢', '護理建議'] },
  { name: '教育 / 補習班', tags: ['課程介紹', '試聽預約', '學費方案', '師資查詢'] },
]

const GRAD = 'linear-gradient(100deg,#0ea5a4,#2563eb 55%,#7c3aed)'

export function CsIntro() {
  return (
    <div className="min-h-screen bg-[#f3f6f8] text-[#0f1720]">
      {/* HERO */}
      <header className="relative overflow-hidden bg-[#0b1620] text-[#eef5f8]">
        <div
          className="pointer-events-none absolute -top-1/3 inset-x-0 h-[70%]"
          style={{ background: 'radial-gradient(60% 100% at 25% 0,rgba(14,165,164,.40),transparent 70%),radial-gradient(50% 100% at 85% 10%,rgba(37,99,235,.32),transparent 70%)' }}
        />
        <div className="relative max-w-5xl mx-auto px-6">
          <nav className="flex items-center gap-3 pt-6 pb-10">
            <span className="grid place-items-center w-8 h-8 rounded-lg text-white shrink-0" style={{ background: GRAD }}>
              <Headphones className="h-4 w-4" />
            </span>
            <b className="font-black tracking-wide">IMT 智能客服</b>
            <span className="ml-auto text-xs text-[#9fb3bf] font-mono">cs.im-tourist.com</span>
          </nav>

          <div className="pb-16 sm:pb-20">
            <div className="font-mono text-[12px] tracking-[0.22em] uppercase text-[#7fe0db]">AI · 多平台智能客服</div>
            <h1 className="mt-4 font-black leading-[1.02] tracking-tight text-[clamp(38px,8.5vw,72px)]" style={{ textWrap: 'balance' } as React.CSSProperties}>
              客服不打烊，<br />
              <span style={{ background: GRAD, WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent' }}>AI 24 小時</span>接住每位客人。
            </h1>
            <p className="mt-5 text-[#9fb3bf] text-[clamp(16px,2.4vw,20px)] max-w-[48ch]">
              選擇行業模板一鍵套用，30 分鐘內啟動 LINE / WhatsApp AI 客服。各平台訊息集中一處，AI 先回、該轉人工的自動開工單。
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/register" className="inline-flex items-center gap-2 font-bold text-[15px] px-6 py-3 rounded-xl text-white transition-transform hover:-translate-y-0.5"
                style={{ background: GRAD, boxShadow: '0 10px 26px rgba(37,99,235,.35)' }}>
                免費開始 <ArrowRight className="h-4 w-4" />
              </Link>
              <a href="#features" className="inline-flex items-center gap-2 font-bold text-[15px] px-6 py-3 rounded-xl text-[#eef5f8] border border-[#1f3140] bg-white/5 transition-transform hover:-translate-y-0.5">
                看它能做什麼
              </a>
            </div>
            <div className="mt-9 flex flex-wrap gap-2">
              {PLATFORMS.map(p => (
                <span key={p.name} className="inline-flex items-center gap-1.5 text-[12.5px] rounded-full px-3 py-1 border border-[#1f3140] bg-white/5 text-[#cfdde5]">
                  <span className="w-1.5 h-1.5 rounded-full" style={{ background: p.color }} />{p.name}
                </span>
              ))}
            </div>
          </div>
        </div>
      </header>

      {/* PRICING HOOK */}
      <div className="border-b border-[#dde5ea]">
        <div className="max-w-5xl mx-auto px-6 py-7">
          <p className="text-[clamp(17px,2.6vw,22px)] font-medium leading-snug" style={{ textWrap: 'balance' } as React.CSSProperties}>
            不限則數，不怕用量爆表加價。
            <span className="text-[#7b8a94]"> 對話量再大，方案價格都固定——不像市場常見的「按則數計費」，用越多帳單越嚇人。</span>
          </p>
        </div>
      </div>

      {/* FEATURES */}
      <section id="features" className="max-w-5xl mx-auto px-6 py-14">
        <div className="font-mono text-[12px] tracking-[0.16em] uppercase text-[#0d8f8e] mb-2">已上線功能</div>
        <h2 className="text-[clamp(24px,4vw,34px)] font-black tracking-tight mb-1">AI 先回，真人只處理該處理的</h2>
        <p className="text-[#56646d] text-[15px] max-w-[56ch] mb-7">從接訊息、查訂單到轉工單，一條龍在同一個工作台完成。</p>
        <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map(f => (
            <div key={f.title} className="flex flex-col gap-2.5 rounded-2xl border border-[#dde5ea] bg-white p-5 transition-transform hover:-translate-y-1 hover:shadow-[0_16px_40px_rgba(15,60,90,0.10)]">
              <f.Icon className="h-5 w-5 text-[#0d8f8e]" />
              <h3 className="font-black text-[18px] tracking-tight">{f.title}</h3>
              <p className="text-[14px] text-[#3d4a52]">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* INDUSTRIES */}
      <section className="relative overflow-hidden bg-[#0b1620] text-[#eef5f8]">
        <div className="pointer-events-none absolute inset-x-0 h-[80%]"
          style={{ bottom: '-40%', background: 'radial-gradient(50% 100% at 70% 100%,rgba(124,58,237,.26),transparent 70%),radial-gradient(50% 100% at 20% 100%,rgba(14,165,164,.28),transparent 70%)' }} />
        <div className="relative max-w-5xl mx-auto px-6 py-14">
          <div className="font-mono text-[12px] tracking-[0.22em] uppercase text-[#7fe0db]">行業模板</div>
          <h2 className="mt-2 mb-2 text-[clamp(24px,4.4vw,38px)] font-black tracking-tight" style={{ textWrap: 'balance' } as React.CSSProperties}>
            選你的行業，
            <span style={{ background: GRAD, WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent' }}>一鍵套用</span>
          </h2>
          <p className="text-[#9fb3bf] max-w-[54ch] mb-7">套用預設模板，AI 自動配置系統提示詞與預訂流程；也可以跳過，直接自訂。</p>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {INDUSTRIES.map(i => (
              <div key={i.name} className="rounded-2xl border border-[#1f3140] bg-[#101f2b] p-4">
                <div className="font-extrabold text-[16px] mb-2">{i.name}</div>
                <div className="flex flex-wrap gap-1.5">
                  {i.tags.map(t => <span key={t} className="text-[11.5px] text-[#b8c9d2] bg-white/5 rounded-md px-2 py-0.5">{t}</span>)}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FINAL CTA */}
      <section className="max-w-5xl mx-auto px-6 py-16 text-center">
        <div className="font-mono text-[12px] tracking-[0.22em] uppercase text-[#0d8f8e]">準備好了嗎</div>
        <h2 className="mt-3 mb-6 text-[clamp(26px,5vw,42px)] font-black tracking-tight" style={{ textWrap: 'balance' } as React.CSSProperties}>
          30 分鐘，<br />啟動你的 AI 客服。
        </h2>
        <div className="flex flex-wrap gap-3 justify-center">
          <Link href="/register" className="inline-flex items-center gap-2 font-bold text-[15px] px-6 py-3 rounded-xl text-white transition-transform hover:-translate-y-0.5"
            style={{ background: GRAD, boxShadow: '0 10px 26px rgba(37,99,235,.35)' }}>
            免費開始 <ArrowRight className="h-4 w-4" />
          </Link>
          <Link href="/login" className="inline-flex items-center gap-2 font-bold text-[15px] px-6 py-3 rounded-xl text-[#0f1720] border border-[#cfd9df] bg-white transition-transform hover:-translate-y-0.5">
            我已有帳號
          </Link>
        </div>
        <p className="mt-4 text-[12px] text-[#7b8a94] inline-flex items-center gap-1">
          <Shield className="h-3.5 w-3.5" /> 免費使用・不限對話次數・資料加密保護
        </p>
      </section>

      <footer className="text-center text-[#7b8a94] text-[12px] py-7 border-t border-[#dde5ea] flex items-center justify-center gap-2">
        <Headphones className="h-3.5 w-3.5" /> IMT 智能客服 · cs.im-tourist.com · IMT
      </footer>
    </div>
  )
}
