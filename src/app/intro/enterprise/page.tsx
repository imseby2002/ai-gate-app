import type { Metadata } from 'next'
import { Check } from 'lucide-react'
import { introTr, trDeep } from '@/lib/i18n-data/server'
import { GRAD, DarkHeader, FinalCta, IntroFooter, GradText } from '../_ui'
import { EnterprisePricing } from '../pricing/EnterprisePricing'

// 企業方案獨立介紹頁（行銷／客服／訂房子網域共用；其他子網域由 middleware 導到 marketing）。
// 價格、內含量與加值服務皆來自 lib/company/enterprise-plans.ts（經 EnterprisePricing 計算）。
export const dynamic = 'force-dynamic'

const META__ZH: Metadata = {
  title: '企業方案｜AI GATE',
  description: 'AI GATE 企業方案：一個方案開通全公司 ERP、行銷、客服與 AI 工具，依據點與人數計價，企業 CORE／PRO／MAX 三級公開定價。',
}

export async function generateMetadata(): Promise<Metadata> {
  return trDeep(META__ZH, await introTr())
}

const MODULE_GROUPS__ZH = [
  { title: '據點與 ERP', items: ['POS 收銀與點餐機', '庫存與叫貨', '財務與損益', '人資與排班', '據點教練與行政事務'] },
  { title: '行銷', items: ['行銷流水線', '圖片與影片生成', '社群內容與發文', '潛在客戶開發工具'] },
  { title: '客服', items: ['AI 客服自動回覆', '客戶記憶', '表單整批處理', '多平台訊息整合'] },
  { title: 'AI 工具', items: ['AI 對話與 RAG 助理', '智慧圓桌', 'AI Agent', '法律合規 AI', 'Office 與職場助手'] },
]

const PRICING_RULES__ZH = [
  { q: '月費固定', a: '每一級的月費都已包含該級的據點、使用人數、AI 點數與客製工時，不會因為月中用量起伏而變動。' },
  { q: '據點可以換成人數', a: '據點沒用滿時，每 1 個可換 5 位使用者。沒有分店的服務業選 MAX，可用人數從 100 人增加到 250 人。' },
  { q: '超出才加購', a: '據點超過含量每個 $10、使用者每人 $2；需要更多點數、客製工時或通訊服務，照加值服務單價加購。' },
  { q: 'AI 點數依實際用量扣', a: 'AI 對話、圖片與影片依原廠成本乘上該級倍率扣點，MAX 倍率最低（× 1.2）。每月點數當月有效。' },
]

const STEPS__ZH = [
  { title: '註冊公司帳號', desc: '先用公司負責人的 Email 註冊，建立公司。' },
  { title: '聯絡我們選擇等級', desc: '依據點數與使用人數建議合適等級，並開通全部模組。' },
  { title: '導入與上線', desc: 'MAX 享首月導入協助：協助設定據點、帳號並進行教育訓練。' },
]

const FAQ__ZH = [
  { q: '什麼是「據點」？', a: '門市、分公司、辦公室、服務站、工廠或倉庫，每一處實體營業地點算 1 個據點。' },
  { q: '可以中途升級嗎？', a: '可以。調整等級後，月費與內含量改依新等級計算；點數池自下個月起依新等級發放。' },
  { q: '專屬功能歸誰？', a: 'MAX 可開發企業專屬的新功能；功能只開給該企業使用，著作權歸平台所有。' },
  { q: '資料歸屬與匯出？', a: '企業的業務資料歸企業所有，合約終止時提供完整匯出。' },
  { q: '付款方式？', a: '以美元計價，可月繳或年繳；PRO 年繳只收 11 個月，MAX 年繳只收 10 個月。' },
  { q: '費用含稅嗎？', a: '報價為未稅金額，各國稅負依當地法規處理。' },
]

export default async function EnterpriseIntroPage() {
  const tr = await introTr()
  const MODULE_GROUPS = trDeep(MODULE_GROUPS__ZH, tr)
  const PRICING_RULES = trDeep(PRICING_RULES__ZH, tr)
  const STEPS = trDeep(STEPS__ZH, tr)
  const FAQ = trDeep(FAQ__ZH, tr)
  return (
    <div className="min-h-screen bg-[#f5f3f8] text-[#17131f]">
      <DarkHeader
        eyebrow={tr('企業方案')}
        title={<>{tr('一個方案，')}<GradText>{tr('開通全公司')}</GradText>{tr('所有 AI 模組')}</>}
        sub={tr('ERP、行銷、客服與 AI 工具一次到位，依據點與人數計價。三級公開定價，需要更多時再加購。')}
      />

      <section className="max-w-5xl mx-auto px-6 py-12">
        <h2 className="text-[clamp(22px,3.6vw,30px)] font-black tracking-tight">{tr('包含哪些模組')}</h2>
        <p className="mt-2 text-[15px] text-[#3f3a4d]">{tr('三級都能使用全部現有模組；MAX 另可開發企業專屬功能。')}</p>
        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {MODULE_GROUPS.map(g => (
            <div key={g.title} className="rounded-2xl bg-white p-5 border border-[#e6e2ee]">
              <h3 className="font-extrabold text-[15px]">{g.title}</h3>
              <ul className="mt-3 space-y-1.5 text-[14px] text-[#3f3a4d]">
                {g.items.map(i => <li key={i} className="flex gap-1.5"><Check className="h-3.5 w-3.5 shrink-0 mt-0.5 text-[#0f9d6e]" />{i}</li>)}
              </ul>
            </div>
          ))}
        </div>
      </section>

      <EnterprisePricing grad={GRAD} showDetailLink={false} />

      <section className="max-w-5xl mx-auto px-6 pb-12">
        <h2 className="text-[clamp(22px,3.6vw,30px)] font-black tracking-tight mb-5">{tr('計價怎麼算')}</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {PRICING_RULES.map(r => (
            <div key={r.q} className="rounded-2xl border border-[#e6e2ee] bg-white p-5">
              <h3 className="font-extrabold text-[15px]">{r.q}</h3>
              <p className="mt-1.5 text-[15px] text-[#3f3a4d]">{r.a}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="max-w-5xl mx-auto px-6 pb-12">
        <h2 className="text-[clamp(22px,3.6vw,30px)] font-black tracking-tight mb-5">{tr('開通流程')}</h2>
        <ol className="grid gap-3 md:grid-cols-3">
          {STEPS.map((s, i) => (
            <li key={s.title} className="rounded-2xl border border-[#e6e2ee] bg-white p-5">
              <div className="h-8 w-8 rounded-full text-white font-black flex items-center justify-center" style={{ background: GRAD }}>{i + 1}</div>
              <h3 className="mt-3 font-extrabold text-[15px]">{s.title}</h3>
              <p className="mt-1.5 text-[15px] text-[#3f3a4d]">{s.desc}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="max-w-5xl mx-auto px-6 pb-16">
        <h2 className="text-[clamp(22px,3.6vw,30px)] font-black tracking-tight mb-5">{tr('常見問題')}</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {FAQ.map(f => (
            <div key={f.q} className="rounded-2xl border border-[#e6e2ee] bg-white p-5">
              <h3 className="font-extrabold text-[15px]">{f.q}</h3>
              <p className="mt-1.5 text-[15px] text-[#3f3a4d]">{f.a}</p>
            </div>
          ))}
        </div>
      </section>

      <FinalCta title={<>{tr('一個方案，')}<br />{tr('讓全公司一起用 AI。')}</>} />
      <IntroFooter />
    </div>
  )
}
