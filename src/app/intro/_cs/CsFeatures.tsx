import Link from 'next/link'
import type { Metadata } from 'next'
import {
  Inbox, Smartphone, Users, MessageCircle, BookOpen, LayoutTemplate, SlidersHorizontal, Languages,
  Sparkles, ShieldCheck, Image as ImageIcon, Globe, Wrench, ShoppingCart, Ticket, Sheet, Calculator,
  Gift, Star, BarChart3, FlaskConical, ArrowRight,
} from 'lucide-react'
import { CsDarkHeader, CsFinalCta, CsFooter, CS_GRAD } from './ui'

export const csFeaturesMetadata: Metadata = {
  title: '完整功能｜IMT 智能客服',
  description: 'IMT 智能客服完整功能：多平台串接、統一收件匣、知識庫、訂單查詢、意圖識別與工單、報價計算機、Google Sheets 資料來源等，並標示各功能可用方案。',
}

type Feature = { Icon: React.ComponentType<{ className?: string }>; title: string; desc: string; points?: string[]; plan?: string }

const GROUPS: Array<{ id: string; n: string; title: string; sub: string; items: Feature[] }> = [
  {
    id: 'connect', n: '01', title: '接入：所有平台，一個後台', sub: '客人在哪裡傳訊息，AI 就在哪裡回。',
    items: [
      {
        Icon: MessageCircle, title: '多平台串接',
        desc: '貼上各平台的金鑰即可串接；Telegram 只要 Bot Token，系統自動註冊 Webhook。',
        points: ['LINE OA', 'WhatsApp Business', 'FB Messenger', 'Instagram Direct', 'Telegram', 'Zalo OA', 'WeChat'],
        plan: 'FREE／CORE／PRO 3 個 · MAX 不限',
      },
      { Icon: Smartphone, title: 'WhatsApp 個人版', desc: '沒有申請 WhatsApp Business API 也能用，手機掃 QR Code 即可串接個人帳號。', plan: 'CORE 起' },
      {
        Icon: Inbox, title: '統一收件匣',
        desc: '所有平台的對話集中在同一個畫面，可直接回覆客人，並隨時切換「AI 自動回覆」或「真人接管」；接手時直接看到 AI 整理的客戶摘要。',
        points: ['跨平台對話集中', 'AI／真人一鍵切換', '回頭客摘要', '手機可安裝成 App'],
        plan: 'CORE 起',
      },
      { Icon: Users, title: '協作人員', desc: '邀請夥伴一起顧客服，可個別開放「可修正 AI」等權限。', plan: 'CORE 1 位 · PRO 5 位 · MAX 不限' },
    ],
  },
  {
    id: 'ai', n: '02', title: 'AI 回覆：答得對，也答得像你', sub: '「AI 的個性」放 AI 設定，「具體資料」放知識庫，AI 才不會亂猜。',
    items: [
      { Icon: LayoutTemplate, title: '行業模板', desc: '民宿／旅遊、電商／零售、餐廳、診所／醫美、美容美髮 SPA、教育補習班，一鍵套用預設講法與預訂流程。' },
      { Icon: BookOpen, title: '知識庫', desc: 'FAQ、房型商品介紹、規定條款放進來，AI 優先從這裡找答案；測試對話中答得好的內容可一鍵加入知識庫。' },
      {
        Icon: SlidersHorizontal, title: 'AI 設定',
        desc: '系統提示詞定義 AI 的角色與語氣，並可設定報價流程、優惠贈品、VIP 關鍵字等進階行為。',
        points: ['系統提示詞', '報價流程', '優惠與贈品（每次只提一項）', 'VIP 關鍵字優先處理'],
        plan: 'FREE 基本 · CORE 起完整',
      },
      { Icon: Languages, title: '多語言自動偵測', desc: '自動偵測客人語言並用同一種語言回覆（中／英／越／日／韓等）。' },
      { Icon: ShieldCheck, title: '高風險對話升級 Claude', desc: '一般問題用快速模型回覆；退換貨、投訴、法律類問題自動升級給更謹慎的 Claude 處理。', plan: 'CORE 起' },
      { Icon: ImageIcon, title: '複雜客服／圖片辨識', desc: '客人傳訂單截圖、照片也能辨識；複雜問題自動轉給更強的模型。圖片辨識出的資料一律先跟客人核對，不直接當成已驗證資料。', plan: 'CORE 起' },
      { Icon: Globe, title: '即時網路搜尋', desc: '天氣、附近景點等知識庫沒有的即時資訊，AI 會上網查了再回答。', plan: 'PRO 起' },
      { Icon: Wrench, title: 'AI 回答修正', desc: '發現 AI 答錯、漏做事或繞圈時，貼上情境、錯誤回覆與正確做法，送出後立即生效，之後遇到類似情境就照規則回答。' },
    ],
  },
  {
    id: 'ops', n: '03', title: '營運：查單、報價、轉真人', sub: '講錯會出事的資訊，一律以系統資料為準。',
    items: [
      {
        Icon: ShoppingCart, title: '訂單查詢串接',
        desc: '民宿訂房業者可讓客人用訂單號碼、訂房姓名或手機號碼直接查入住資訊；Trip.com、KKday、四方通行等單號對不上的平台，改以姓名比對（中文對拼音也能比）。',
        points: ['入住時間前不給密碼', '姓名非逐字相符先核對', '查無資料不捏造', '兩種方式都查不到自動轉真人'],
        plan: '搭配 IMT 訂房系統 PRO 起',
      },
      {
        Icon: Sparkles, title: '意圖識別',
        desc: '偵測客人要求轉真人、詢問訂金／尾款、查無訂單等特定情境；搭配工單系統（CORE 起）自動建立對應工單通知專員，不怕漏接。',
      },
      { Icon: Ticket, title: '工單系統', desc: '需要真人處理的對話自動開工單，追蹤待處理／處理中／已解決／已結案，並可透過 LINE、Telegram 或 webhook 通知負責人。', plan: 'CORE 起' },
      { Icon: Sheet, title: '資料來源（Google Sheets）', desc: '已經用 Google Sheets 記錄訂單、密碼、庫存？直接串接，客人問到關鍵字時 AI 即時查表回答。', plan: 'CORE 起' },
      { Icon: Calculator, title: '報價計算機', desc: '設定房型、票種、平假日價、國定連假、團體折扣，AI 報價時照公式計算，不用猜也不會算錯錢。', plan: 'MAX' },
      { Icon: Gift, title: '優惠與 VIP', desc: '客人猶豫或嫌貴時 AI 主動提優惠；常客的名字、暱稱或手機後 4 碼命中 VIP 關鍵字時，對話自動標示優先處理。' },
    ],
  },
  {
    id: 'insight', n: '04', title: '上線前後：測得到，也看得到', sub: '先測試再上線，上線後看數據補強。',
    items: [
      { Icon: FlaskConical, title: '測試對話', desc: '正式上線前假裝自己是客人跟 AI 對話，確認知識庫、報價、升級規則都生效。' },
      { Icon: BarChart3, title: '紀錄與報表', desc: '看 AI 每天回答了多少問題、熱門問題與回應速度，找出知識庫還要補強的地方。' },
      { Icon: Star, title: '協助設定', desc: '不會設定就按「找人幫我設定」，我們代為完成站內設定與平台串接（不含知識庫內容建立與官方帳號申請）。', plan: 'PRO 每月 1 次 · MAX 每月 2 次免費' },
    ],
  },
]

export function CsFeatures() {
  return (
    <div className="min-h-screen bg-[#f3f6f8] text-[#0f1720]">
      <CsDarkHeader
        eyebrow="完整功能"
        title="從接訊息到轉真人，每一步都有 AI"
        sub="下面列出 IMT 智能客服的所有功能；有標示方案的功能需對應方案才能使用，沒標示的所有方案都能用。"
      />

      <div className="sticky top-0 z-10 border-b border-[#dde5ea] bg-[#f3f6f8]/90 backdrop-blur">
        <div className="max-w-5xl mx-auto px-6 py-3 flex gap-2 overflow-x-auto text-[13px] font-bold">
          {GROUPS.map(g => (
            <a key={g.id} href={`#${g.id}`} className="shrink-0 rounded-full border border-[#dde5ea] bg-white px-3 py-1 hover:border-[#0d8f8e]">
              {g.n} {g.title.split('：')[0]}
            </a>
          ))}
          <Link href="/intro/pricing" className="shrink-0 rounded-full px-3 py-1 text-white" style={{ background: CS_GRAD }}>方案價格</Link>
        </div>
      </div>

      {GROUPS.map(g => (
        <section key={g.id} id={g.id} className="max-w-5xl mx-auto px-6 py-12 scroll-mt-16">
          <div className="flex items-baseline gap-3">
            <span className="font-mono font-extrabold text-[13px] text-[#0d8f8e]">{g.n}</span>
            <h2 className="text-[clamp(22px,3.6vw,30px)] font-black tracking-tight">{g.title}</h2>
          </div>
          <p className="text-[#56646d] text-[15px] mb-6">{g.sub}</p>
          <div className="grid gap-3.5 sm:grid-cols-2">
            {g.items.map(f => (
              <div key={f.title} className="flex flex-col gap-2 rounded-2xl border border-[#dde5ea] bg-white p-5">
                <div className="flex items-start gap-3">
                  <span className="grid place-items-center w-9 h-9 shrink-0 rounded-xl text-white" style={{ background: CS_GRAD }}><f.Icon className="h-4 w-4" /></span>
                  <div className="min-w-0">
                    <h3 className="font-black text-[17px] leading-tight">{f.title}</h3>
                    {f.plan && <span className="inline-block mt-1 text-[11px] font-bold text-[#2563eb] bg-[#2563eb]/10 rounded-md px-1.5 py-0.5">{f.plan}</span>}
                  </div>
                </div>
                <p className="text-[14px] text-[#3d4a52]">{f.desc}</p>
                {f.points && (
                  <div className="mt-auto flex flex-wrap gap-1.5 pt-1">
                    {f.points.map(p => <span key={p} className="text-[11.5px] text-[#56646d] bg-[#eef3f6] rounded-md px-2 py-0.5">{p}</span>)}
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      ))}

      <section className="max-w-5xl mx-auto px-6 pb-14">
        <Link href="/intro/pricing" className="flex items-center justify-between gap-4 rounded-2xl p-6 text-white" style={{ background: CS_GRAD }}>
          <div>
            <div className="font-black text-[20px]">每個方案有哪些功能？</div>
            <div className="text-white/85 text-[14px]">FREE／CORE／PRO／MAX 逐項比較</div>
          </div>
          <ArrowRight className="h-6 w-6 shrink-0" />
        </Link>
      </section>

      <CsFinalCta title="先用免費方案接上 LINE 試試看" sub="不限訊息則數，隨時可升級。" />
      <CsFooter />
    </div>
  )
}
