import Link from 'next/link'
import type { Metadata } from 'next'
import {
  Building2, Globe, BedDouble, Download, Users, CalendarCheck, List, LayoutGrid, CalendarDays, ClipboardList,
  Tag, TrendingUp, Search, Percent, Zap, Mail, RefreshCw, Headphones, Bell, Star, BarChart2, LifeBuoy, ArrowRight,
} from 'lucide-react'
import { BkDarkHeader, BkFinalCta, BkFooter, BK_GRAD } from './ui'

export const bookingFeaturesMetadata: Metadata = {
  title: '完整功能｜IMT 智能訂房系統',
  description: 'IMT 智能訂房系統完整功能：AI 設計官網、線上訂房、空房表、每日入住、動態定價、優惠碼、iCal／Email／即時同步 60+ 平台、通知信、評價與數據報表，並標示各功能可用方案。',
}

type Feature = { Icon: React.ComponentType<{ className?: string }>; title: string; desc: string; points?: string[]; plan?: string }

// 內容對齊 /booking 各功能頁；方案標示對齊 lib/booking/entitlements.ts
const GROUPS: Array<{ id: string; n: string; title: string; sub: string; items: Feature[] }> = [
  {
    id: 'setup', n: '01', title: '開站：民宿資料與官網', sub: '資料建一次，官網、訂房、同步都用同一份。',
    items: [
      {
        Icon: Globe, title: '官網 AI 設計',
        desc: '選一種視覺風格或直接跟 AI 設計助手描述想要的感覺，自動生成民宿官網；電腦版、手機版即時預覽，旅客可直接在官網訂房。',
        points: ['4 種預設模板', 'AI 自由生成專屬設計', '主題色／副標語', 'SEO 標題與摘要', '民宿故事、主人介紹、FAQ'],
      },
      { Icon: Download, title: '從 OTA 一鍵匯入', desc: '貼上 Booking.com、Agoda 等平台的民宿頁面網址，AI 解析民宿資料、設施與房型，確認後一鍵建立，不用重新建檔。' },
      { Icon: Building2, title: '民宿資料', desc: '民宿名稱、聯絡方式、入住／退房時間與入住規則，官網與通知信都會帶入。' },
      { Icon: BedDouble, title: '房型管理', desc: '設定各房間與各平台上的房型別名，Email 同步時自動比對到正確房間。', plan: 'FREE 1 房源 · CORE／PRO 5 · MAX 15（可加購）' },
      { Icon: Users, title: '協作成員', desc: '邀請夥伴一起管理訂單與房況。', plan: 'CORE 1 位 · PRO 2 位 · MAX 不限' },
    ],
  },
  {
    id: 'orders', n: '02', title: '訂單：所有來源，一張表', sub: '官網直訂、手動輸入、各平台同步進來的訂單，都在同一個地方。',
    items: [
      {
        Icon: CalendarCheck, title: '線上訂房',
        desc: '旅客在官網送出訂房申請；可設定自動確認，或由你手動點「確認訂房」後自動轉為正式訂單並寄確認信。',
        points: ['自動／手動確認', '確認後自動寄信', '可套用優惠碼'],
      },
      { Icon: List, title: '訂單管理', desc: '所有訂單集中列表，查看詳情、一鍵寄通知信給旅客。' },
      { Icon: LayoutGrid, title: '空房表', desc: '一張表看所有房間每天的可訂、已訂、關閉狀態；拖曳訂單即可換房、改期，也能批次開關房。' },
      { Icon: CalendarDays, title: '日曆訂房', desc: '以日曆檢視每天的空房與訂單，直接在日曆上加入訂單，同一位旅客可一次訂多間房並加床。' },
      {
        Icon: ClipboardList, title: '每日入住',
        desc: '每天誰入住、住哪間、大門與房門密碼、旅客資訊一頁列清楚；系統訂單自動帶入，手機可安裝成 App 一鍵開啟。',
        points: ['大門密碼套用全棟', '房門密碼延續之後日期', '續住一鍵帶入', '密碼預設隱藏'],
      },
    ],
  },
  {
    id: 'pricing', n: '03', title: '定價：自動調價，還能看行情', sub: '規則設一次，房價自己跟著日子與住房率走。',
    items: [
      { Icon: Tag, title: '每日定價', desc: '逐日或以格狀視圖設定每間房的價格與開放狀態。' },
      {
        Icon: TrendingUp, title: '動態定價規則',
        desc: '依日期與住房率自動加減價，也能排程跟隨市場行情自動調整。',
        points: ['週末', '假日', '季節性', '住房率', '臨時訂', '早鳥訂', '市場跟隨'],
        plan: 'CORE 起 · MAX 可客製規則',
      },
      { Icon: Search, title: '周邊比價', desc: '查詢同地區、指定入住日的周邊旅宿房價清單與統計（資料來源 Google Hotels），定價前先看行情。' },
      { Icon: Percent, title: '折扣與優惠碼', desc: '建立折扣碼，旅客在官網訂房時直接套用。', plan: 'CORE 起' },
    ],
  },
  {
    id: 'sync', n: '04', title: '同步：不再重複訂房', sub: '三種同步方式，依方案與通路搭配使用。',
    items: [
      {
        Icon: Zap, title: '即時同步 60+ 平台',
        desc: '秒級同步各大訂房平台的房況與訂單，訂單直接進每日入住表，不用再手動比對各平台後台。開通時由我們協助完成通路串接。',
        points: ['Booking.com', 'Airbnb', 'Agoda', 'Expedia', 'Hostelworld', 'Ctrip', 'Google Hotel Search', '其他 50+ 通路'],
        plan: 'PRO 起',
      },
      { Icon: Mail, title: 'Email 同步', desc: '連接信箱，自動從各平台的訂房確認信解析出訂單（備援用）。', plan: 'CORE 起' },
      { Icon: RefreshCw, title: 'iCal 同步', desc: '用各平台提供的 iCal 連結自動匯入訂單，每小時同步一次（備援，非即時）。' },
      { Icon: Headphones, title: '串接 IMT 智能客服', desc: '旅客在 LINE、WhatsApp 等平台問訂單時，AI 客服可用訂單號碼、姓名或手機直接查詢入住資訊；入住時間前不給密碼。', plan: 'PRO 起' },
    ],
  },
  {
    id: 'guest', n: '05', title: '旅客與數據', sub: '溝通、口碑、營收，一起看。',
    items: [
      {
        Icon: Bell, title: '通知信',
        desc: '設定各類通知信模板，在訂單管理中一鍵寄給旅客；可用佔位符自動帶入訂單資料。',
        points: ['訂房確認信', '入住提醒信', '退房提醒', '取消通知'],
      },
      { Icon: Star, title: '評價管理', desc: '記錄來自各平台或私訊的旅客評價並回覆，追蹤平均分數與回覆率（回覆只存在本系統，不會自動貼回平台）。' },
      {
        Icon: BarChart2, title: '數據報表',
        desc: '年度月度趨勢、各通路與各房型分析，可匯出 CSV。',
        points: ['交易額', '平均房價', '住房率', '訂單數', '住房晚數', '平均入住晚數'],
      },
      { Icon: LifeBuoy, title: '人工協助設定', desc: '協助完成各平台通路串接與站內功能設定；向各平台申請上架帳號不包含在內，需另外委託。', plan: 'PRO 每月 1 次 · MAX 每月 2 次免費' },
    ],
  },
]

export function BookingFeatures() {
  return (
    <div className="min-h-screen bg-[#f7f5f2] text-[#1a1612]">
      <BkDarkHeader
        eyebrow="完整功能"
        title="從開站、接單到入住，一個後台"
        sub="下面列出 IMT 智能訂房系統的所有功能；有標示方案的功能需對應方案才能使用，沒標示的所有方案都能用。"
      />

      <div className="sticky top-0 z-10 border-b border-[#e7e1d9] bg-[#f7f5f2]/90 backdrop-blur">
        <div className="max-w-5xl mx-auto px-6 py-3 flex gap-2 overflow-x-auto text-[13px] font-bold">
          {GROUPS.map(g => (
            <a key={g.id} href={`#${g.id}`} className="shrink-0 rounded-full border border-[#e7e1d9] bg-white px-3 py-1 hover:border-[#c2410c]">
              {g.n} {g.title.split('：')[0]}
            </a>
          ))}
          <Link href="/intro/pricing" className="shrink-0 rounded-full px-3 py-1 text-white" style={{ background: BK_GRAD }}>方案比較</Link>
        </div>
      </div>

      {GROUPS.map(g => (
        <section key={g.id} id={g.id} className="max-w-5xl mx-auto px-6 py-12 scroll-mt-16">
          <div className="flex items-baseline gap-3">
            <span className="font-mono font-extrabold text-[13px] text-[#c2410c]">{g.n}</span>
            <h2 className="text-[clamp(22px,3.6vw,30px)] font-black tracking-tight">{g.title}</h2>
          </div>
          <p className="text-[#5f554c] text-[15px] mb-6">{g.sub}</p>
          <div className="grid gap-3.5 sm:grid-cols-2">
            {g.items.map(f => (
              <div key={f.title} className="flex flex-col gap-2 rounded-2xl border border-[#e7e1d9] bg-white p-5">
                <div className="flex items-start gap-3">
                  <span className="grid place-items-center w-9 h-9 shrink-0 rounded-xl text-white" style={{ background: BK_GRAD }}><f.Icon className="h-4 w-4" /></span>
                  <div className="min-w-0">
                    <h3 className="font-black text-[17px] leading-tight">{f.title}</h3>
                    {f.plan && <span className="inline-block mt-1 text-[11px] font-bold text-[#c2410c] bg-[#c2410c]/10 rounded-md px-1.5 py-0.5">{f.plan}</span>}
                  </div>
                </div>
                <p className="text-[14px] text-[#4a4038]">{f.desc}</p>
                {f.points && (
                  <div className="mt-auto flex flex-wrap gap-1.5 pt-1">
                    {f.points.map(p => <span key={p} className="text-[11.5px] text-[#5f554c] bg-[#f3eee8] rounded-md px-2 py-0.5">{p}</span>)}
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      ))}

      <section className="max-w-5xl mx-auto px-6 pb-14">
        <Link href="/intro/pricing" className="flex items-center justify-between gap-4 rounded-2xl p-6 text-white" style={{ background: BK_GRAD }}>
          <div>
            <div className="font-black text-[20px]">每個方案有哪些功能？</div>
            <div className="text-white/85 text-[14px]">FREE／CORE／PRO／MAX 逐項比較</div>
          </div>
          <ArrowRight className="h-6 w-6 shrink-0" />
        </Link>
      </section>

      <BkFinalCta title="先用免費方案做好你的官網" sub="FREE 方案含 1 房源、官網 AI 設計與 iCal 同步，隨時可升級。" />
      <BkFooter />
    </div>
  )
}
