// 服務預約系統介紹頁（reserve.im-tourist.com/intro）與方案頁（/intro/pricing）。
// 內容只列目前站內已上線的功能（見 app/(tools)/reserve 與 app/api/reserve）；文案經 introTr 翻譯。
import Link from 'next/link'
import type { Metadata } from 'next'
import { getLocale } from 'next-intl/server'
import { ArrowRight, CalendarDays, Check, Clock, Globe, LayoutTemplate, MessageSquare, Scissors, Sparkles, Store, Users, UserCheck } from 'lucide-react'
import { introTr, trDeep } from '@/lib/i18n-data/server'
import type { Tr } from '@/lib/i18n-data/tr-core'
import { LanguageSwitcher } from '@/components/layout/LanguageSwitcher'

const GRAD = 'linear-gradient(100deg,#0ea5a4,#2563eb)'

export const reserveMetadata: Metadata = {
  title: 'IMT 服務預約系統｜免費線上預約與排班',
  description: '美容美髮、診所、健身教練、寵物美容與專業諮詢的線上預約、人員排班、行事曆與顧客管理，全部免費使用。',
}
export const reservePricingMetadata: Metadata = {
  title: '費用｜IMT 服務預約系統',
  description: 'IMT 服務預約系統單店免費：線上預約頁、人員排班、行事曆、預約與顧客管理、產業範本；多分店與自訂簡訊 CORE 每月 5 美元；AI 助理與簡訊依用量扣點。',
}

const FEATURES__ZH = [
  { key: 'page', title: '專屬線上預約頁', desc: '每間店一個預約網址，客人自己選服務、選人員、選時段，不用再一則則回訊息喬時間。' },
  { key: 'services', title: '服務項目與價格', desc: '依分類建立服務，設定時長、價格與服務之間的緩衝時間，可用時段自動算好。' },
  { key: 'staff', title: '人員與排班', desc: '設定每位人員可提供的服務與上班時間，客人可指定人員或交給系統安排。' },
  { key: 'calendar', title: '行事曆與預約管理', desc: '用行事曆一眼看完當天、當週的預約，新增、改期與完成狀態都在同一處處理。' },
  { key: 'customers', title: '顧客名單', desc: '客人預約後自動建檔，累積聯絡方式與預約紀錄，回訪與關懷更方便。' },
  { key: 'template', title: '產業範本一鍵套用', desc: '診所、美髮、美容美甲、健身教練、寵物美容、顧問諮詢六種範本，服務與人員一次建好再微調。' },
  { key: 'branches', title: '多分店管理', desc: 'CORE 方案一個帳號最多管理 20 間分店，每間有自己的預約網址、服務、人員與營業時間；新分店可一鍵複製現有門市設定。' },
  { key: 'sms', title: '預約簡訊提醒', desc: '預約前自動發簡訊提醒客人，提前時間與內容自己設定，減少爽約（簡訊依實際發送扣點）。' },
  { key: 'ai', title: 'AI 預約與營運助理', desc: '依你門市的真實空檔推薦時段、撰寫回訪關懷訊息，並用近 30 天預約分析產能與尖離峰（依用量扣點）。' },
]
const ICONS: Record<string, typeof Globe> = { page: Globe, services: Scissors, staff: Users, calendar: CalendarDays, customers: UserCheck, template: LayoutTemplate, sms: MessageSquare, branches: Store, ai: Sparkles }

const FREE_ITEMS__ZH = ['線上預約頁', '服務項目與價格', '人員與排班', '行事曆與預約管理', '顧客名單', '產業範本一鍵套用', '營業時間與時段間隔設定', '1 間門市', '簡訊提醒（固定內容，依用量扣點）']
const CORE_ITEMS__ZH = ['FREE 全部功能', '最多 20 間分店，各自獨立預約網址', '新分店一鍵複製設定、服務與人員', '自訂簡訊提醒內容']

const FAQ__ZH = [
  { q: '真的完全免費嗎？', a: '單店的預約、排班、行事曆與顧客管理都免費，不限服務項目與預約筆數；AI 助理與簡訊提醒依實際用量扣點。要管理多間分店或自訂簡訊內容，升級 CORE 每月 5 美元。' },
  { q: '適合哪些店家？', a: '需要客人事先預約時段的服務業，例如美容美髮、美甲美睫、診所與物理治療、健身教練、寵物美容、法律與商務諮詢。' },
  { q: '需要另外架網站嗎？', a: '不用。系統會給你一個專屬預約網址，可以放在 LINE、Instagram、Google 商家或任何地方。' },
  { q: '想讓客服自動回覆客人怎麼辦？', a: '搭配 IMT 智能客服後，AI 客服會在 LINE、WhatsApp 等平台回答服務項目與價格、近期空檔，提供線上預約連結，客人留手機號碼還能查自己的預約。' },
]

// 方案比對表（與 lib/reserve/entitlements.ts、lib/ecpay/reserve-plans.ts 一致）
const COMPARE__ZH: { item: string; free: string | boolean; core: string | boolean }[] = [
  { item: '月費', free: '$0', core: '$5／月或 $50／年' },
  { item: '門市／分店數', free: '1 間', core: '最多 20 間' },
  { item: '新分店一鍵複製設定、服務與人員', free: false, core: true },
  { item: '線上預約頁', free: true, core: true },
  { item: '服務項目與價格', free: true, core: true },
  { item: '人員與排班', free: true, core: true },
  { item: '行事曆與預約管理', free: true, core: true },
  { item: '顧客名單', free: true, core: true },
  { item: '產業範本一鍵套用', free: true, core: true },
  { item: '營業時間與時段間隔設定', free: true, core: true },
  { item: '客服串接（查空檔、預約連結、依電話查預約）', free: true, core: true },
  { item: '簡訊提醒（依用量扣點）', free: '固定內容', core: '可自訂內容' },
  { item: 'AI 預約與營運助理（依用量扣點）', free: true, core: true },
]

function CompareTable({ tr }: { tr: Tr }) {
  const rows = trDeep(COMPARE__ZH, tr)
  const cell = (v: string | boolean) => v === true
    ? <Check className="h-4 w-4 mx-auto text-teal-600" aria-label={tr('有')} />
    : v === false ? <span className="text-slate-300" aria-label={tr('無')}>—</span> : <span>{v}</span>
  return (
    <section className="max-w-5xl mx-auto px-6 pb-12">
      <h2 className="text-[clamp(22px,3.6vw,30px)] font-black tracking-tight mb-5">{tr('方案比較')}</h2>
      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
        <table className="w-full text-[14px]">
          <thead>
            <tr className="border-b bg-slate-50">
              <th className="text-left font-bold px-4 py-3">{tr('項目')}</th>
              <th className="font-extrabold tracking-widest px-4 py-3 w-28">FREE</th>
              <th className="font-extrabold tracking-widest px-4 py-3 w-36 text-blue-600">CORE</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.item} className="border-b last:border-0">
                <td className="px-4 py-2.5 text-slate-700">{r.item}</td>
                <td className="px-4 py-2.5 text-center">{cell(r.free)}</td>
                <td className="px-4 py-2.5 text-center">{cell(r.core)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-[13px] text-slate-500">{tr('CORE 以綠界一次付款，月繳 30 天、年繳 365 天，不自動續扣。')}</p>
    </section>
  )
}

function Header({ tr, locale }: { tr: (s: string) => string; locale: string }) {
  return (
    <nav className="flex items-center gap-3 pt-6 pb-10 flex-wrap">
      <Link href="/intro" className="flex items-center gap-3">
        <span className="grid place-items-center w-8 h-8 rounded-lg text-white shrink-0" style={{ background: GRAD }}><Clock className="h-4 w-4" /></span>
        <b className="font-black tracking-wide">{tr('IMT 服務預約系統')}</b>
      </Link>
      <div className="ml-auto flex items-center gap-4 text-[14px] text-slate-200">
        <Link href="/intro/pricing" className="hover:text-white">{tr('費用')}</Link>
        <Link href="/intro/enterprise" className="hover:text-white">{tr('企業方案')}</Link>
        <Link href="/login" className="hover:text-white">{tr('登入')}</Link>
        <span className="text-white [&_.bg-popover]:text-foreground"><LanguageSwitcher currentLocale={locale} /></span>
      </div>
    </nav>
  )
}

function Cta({ label }: { label: string }) {
  return (
    <Link href="/register" className="inline-flex items-center gap-2 font-bold text-[15px] px-6 py-3 rounded-xl text-white" style={{ background: GRAD }}>
      {label} <ArrowRight className="h-4 w-4" />
    </Link>
  )
}

function Hero({ tr, locale, eyebrow, title, sub }: { tr: (s: string) => string; locale: string; eyebrow: string; title: string; sub: string }) {
  return (
    <header className="bg-[#0b1726] text-white">
      <div className="max-w-5xl mx-auto px-6 pb-14">
        <Header tr={tr} locale={locale} />
        <p className="font-mono text-[12px] tracking-[0.16em] text-teal-300">{eyebrow}</p>
        <h1 className="mt-3 text-[clamp(30px,5.6vw,52px)] font-black leading-tight tracking-tight">{title}</h1>
        <p className="mt-4 max-w-2xl text-[16px] text-slate-300">{sub}</p>
        <div className="mt-7"><Cta label={tr('免費開始')} /></div>
      </div>
    </header>
  )
}

function Footer({ tr }: { tr: (s: string) => string }) {
  return (
    <footer className="border-t py-6 text-center text-[13px] text-slate-500 space-x-4">
      <Link href="/intro" className="hover:text-slate-700">{tr('功能介紹')}</Link>
      <Link href="/intro/pricing" className="hover:text-slate-700">{tr('費用')}</Link>
      <Link href="/intro/enterprise" className="hover:text-slate-700">{tr('企業方案')}</Link>
      <Link href="/privacy" className="hover:text-slate-700">{tr('隱私權政策')}</Link>
    </footer>
  )
}

function FaqList({ items }: { items: { q: string; a: string }[] }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {items.map(f => (
        <div key={f.q} className="rounded-2xl border border-slate-200 bg-white p-5">
          <h3 className="font-extrabold text-[15px]">{f.q}</h3>
          <p className="mt-1.5 text-[15px] text-slate-600">{f.a}</p>
        </div>
      ))}
    </div>
  )
}

export async function ReserveIntro() {
  const tr = await introTr()
  const locale = await getLocale()
  const FEATURES = trDeep(FEATURES__ZH, tr)
  const FAQ = trDeep(FAQ__ZH, tr)
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <Hero tr={tr} locale={locale} eyebrow={tr('服務預約系統')}
        title={tr('讓客人自己線上預約，排班與時段一次搞定')}
        sub={tr('美容美髮、診所、健身教練、寵物美容與專業諮詢都適用。線上預約頁、人員排班、行事曆與顧客名單全部免費。')} />

      <section className="max-w-5xl mx-auto px-6 py-12">
        <h2 className="text-[clamp(22px,3.6vw,30px)] font-black tracking-tight mb-5">{tr('功能')}</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map(f => {
            const Icon = ICONS[f.key]
            return (
              <div key={f.key} className="rounded-2xl border border-slate-200 bg-white p-5">
                <span className="h-10 w-10 rounded-xl bg-teal-50 text-teal-600 flex items-center justify-center"><Icon className="h-5 w-5" /></span>
                <h3 className="mt-3 font-extrabold text-[15px]">{f.title}</h3>
                <p className="mt-1.5 text-[14.5px] text-slate-600">{f.desc}</p>
              </div>
            )
          })}
        </div>
      </section>

      <section className="max-w-5xl mx-auto px-6 pb-12">
        <div className="rounded-2xl p-6 text-white flex flex-wrap items-center justify-between gap-4" style={{ background: GRAD }}>
          <div>
            <h2 className="text-[22px] font-black">{tr('基本功能全部免費')}</h2>
            <p className="mt-1 text-[15px] text-white/85">{tr('不限服務項目與預約筆數；AI 助理依用量扣點。')}</p>
          </div>
          <Link href="/intro/pricing" className="font-bold text-[14px] bg-white text-slate-900 rounded-xl px-5 py-2.5">{tr('看費用說明 →')}</Link>
        </div>
      </section>

      <CompareTable tr={tr} />

      <section className="max-w-5xl mx-auto px-6 pb-16">
        <h2 className="text-[clamp(22px,3.6vw,30px)] font-black tracking-tight mb-5">{tr('常見問題')}</h2>
        <FaqList items={FAQ} />
      </section>
      <Footer tr={tr} />
    </div>
  )
}

export async function ReservePricing() {
  const tr = await introTr()
  const locale = await getLocale()
  const FREE_ITEMS = trDeep(FREE_ITEMS__ZH, tr)
  const CORE_ITEMS = trDeep(CORE_ITEMS__ZH, tr)
  const FAQ = trDeep(FAQ__ZH, tr)
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <Hero tr={tr} locale={locale} eyebrow={tr('費用')} title={tr('預約系統基本功能免費')}
        sub={tr('單店預約、排班、行事曆與顧客管理不限筆數免費使用；多分店與自訂簡訊升級 CORE，AI 助理與簡訊依實際用量扣點。')} />

      <section className="max-w-5xl mx-auto px-6 py-12 grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl border-2 border-teal-500 bg-white p-6">
          <div className="font-extrabold tracking-widest text-[14px]">FREE</div>
          <div className="mt-2"><span className="text-[40px] font-black leading-none">$0</span><span className="text-[13px] text-slate-500"> {tr('美元／月')}</span></div>
          <ul className="mt-5 space-y-2 text-[14.5px]">
            {FREE_ITEMS.map(i => <li key={i} className="flex gap-2"><Check className="h-4 w-4 mt-0.5 shrink-0 text-teal-600" />{i}</li>)}
          </ul>
          <div className="mt-6"><Cta label={tr('免費開始')} /></div>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-6">
          <div className="font-extrabold tracking-widest text-[14px]">CORE</div>
          <div className="mt-2"><span className="text-[40px] font-black leading-none">$5</span><span className="text-[13px] text-slate-500"> {tr('美元／月')}</span></div>
          <div className="mt-1 text-[13px] text-slate-500">{tr('年繳 50 美元（省 10 美元）')}</div>
          <ul className="mt-5 space-y-2 text-[14.5px]">
            {CORE_ITEMS.map(i => <li key={i} className="flex gap-2"><Check className="h-4 w-4 mt-0.5 shrink-0 text-blue-600" />{i}</li>)}
          </ul>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-6">
          <div className="font-extrabold text-[16px]">{tr('AI 預約與營運助理')}</div>
          <p className="mt-2 text-[14.5px] text-slate-600">{tr('智慧排程推薦、回訪關懷訊息、產能分析，依每次實際使用的 AI 用量扣點，用多少扣多少。')}</p>
          <div className="mt-6 border-t pt-5 font-extrabold text-[16px]">{tr('搭配 IMT 智能客服')}</div>
          <p className="mt-2 text-[14.5px] text-slate-600">{tr('訂閱 IMT 智能客服後，AI 客服會直接讀取預約系統：回答服務與空檔、提供預約連結、依手機號碼查詢客人的預約。')}</p>
          <a href="https://cs.im-tourist.com/intro/pricing" className="mt-4 inline-block font-bold text-[14px] text-blue-600 hover:underline">{tr('看客服方案 →')}</a>
          <div className="mt-6 border-t pt-5 font-extrabold text-[16px]">{tr('整間公司一起用')}</div>
          <p className="mt-2 text-[14.5px] text-slate-600">{tr('企業方案一次開通 ERP、行銷、客服與 AI 工具，依據點與人數計價。')}</p>
          <Link href="/intro/enterprise" className="mt-4 inline-block font-bold text-[14px] text-blue-600 hover:underline">{tr('看企業方案 →')}</Link>
        </div>
      </section>

      <CompareTable tr={tr} />

      <section className="max-w-5xl mx-auto px-6 pb-16">
        <h2 className="text-[clamp(22px,3.6vw,30px)] font-black tracking-tight mb-5">{tr('常見問題')}</h2>
        <FaqList items={FAQ} />
      </section>
      <Footer tr={tr} />
    </div>
  )
}
