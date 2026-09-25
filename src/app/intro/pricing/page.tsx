import Link from 'next/link'
import type { Metadata } from 'next'
import { Check } from 'lucide-react'
import { PLAN_CARDS, COMPARISON_ROWS } from '@/lib/marketing/plan-compare'
import { GRAD, DarkHeader, FinalCta, IntroFooter, GradText } from '../_ui'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: '方案比較｜AI GATE 行銷中心',
  description: 'AI GATE 行銷中心免費／PRO／TEAM／企業方案價格與功能逐項比較。',
}

const FIT: Record<string, string> = {
  free: '想先試試 AI 能產出什麼的個人',
  pro: '自己經營的小店、個人品牌，需要大量圖文與 Email 開發',
  team: '要影片、電訪、流水線全自動的團隊',
  enterprise: '需要主播影片與客製功能的企業',
}

const FAQ = [
  { q: '生成費用怎麼算？', a: '訂閱費解鎖功能；圖片、影片、主播影片、電訪、Email 等生成成本以儲值點數另計，用多少扣多少。' },
  { q: '會自動續訂嗎？', a: '不會。付款後方案立即生效，到期前不自動續訂，需要延續再自行購買。' },
  { q: '可以中途升級嗎？', a: '可以，隨時在後台「訂閱方案」頁升級。' },
  { q: '付款方式？', a: '以美金定價，結帳時依即時匯率換算為新台幣，透過綠界付款。' },
]

function cell(v: string) {
  if (v === '✓') return <Check className="h-4 w-4 mx-auto text-[#0f9d6e]" />
  if (v === '—') return <span className="text-[#c9c3d6]">—</span>
  return v
}

export default function IntroPricingPage() {
  return (
    <div className="min-h-screen bg-[#f5f3f8] text-[#17131f]">
      <DarkHeader
        eyebrow="方案比較"
        title={<>先免費，<GradText>需要時再升級</GradText>。</>}
        sub="所有方案都能使用 13 項 AI 專家技能；差別在能開幾個行銷案、能自動化到多深。"
      />

      <section className="max-w-5xl mx-auto px-6 py-12">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-2xl bg-white p-5 border border-[#e6e2ee] flex flex-col">
            <div className="font-extrabold tracking-widest text-[14px]">FREE</div>
            <div className="mt-2 text-[28px] font-black">$0</div>
            <div className="text-[13px] text-[#6b6480]">永久免費</div>
            <p className="mt-3 text-[14px] text-[#3f3a4d]">{FIT.free}</p>
            <Link href="/register" className="mt-auto pt-4">
              <span className="block text-center rounded-xl border border-[#d9d3e6] py-2.5 text-[14px] font-bold hover:border-[#6a4be0]">免費開始</span>
            </Link>
          </div>
          {PLAN_CARDS.map(c => {
            const hi = c.plan === 'team'
            return (
              <div key={c.plan} className={`relative rounded-2xl bg-white p-5 border flex flex-col ${hi ? 'border-[#6a4be0] shadow-[inset_0_0_0_1px_#6a4be0]' : 'border-[#e6e2ee]'}`}>
                {hi && <span className="absolute -top-2.5 left-5 text-[10.5px] font-bold text-white rounded-full px-2 py-0.5" style={{ background: GRAD }}>推薦</span>}
                <div className="font-extrabold tracking-widest text-[14px]">{c.name}</div>
                <div className="mt-2 text-[28px] font-black">${c.monthlyUsd}<span className="text-[14px] font-medium text-[#6b6480]"> 美元/月</span></div>
                <div className="text-[13px] text-[#0f9d6e] font-bold">年繳 ${c.yearlyUsd}（平均 ${(c.yearlyUsd / 12).toFixed(2)}/月）</div>
                <p className="mt-3 text-[14px] text-[#3f3a4d]">{FIT[c.plan]}</p>
                <ul className="mt-3 space-y-1.5 text-[14px]">
                  {c.features.map(f => <li key={f} className="flex gap-1.5"><Check className="h-3.5 w-3.5 shrink-0 mt-0.5 text-[#0f9d6e]" />{f}</li>)}
                </ul>
                <Link href="/register" className="mt-auto pt-4">
                  <span className={`block text-center rounded-xl py-2.5 text-[14px] font-bold ${hi ? 'text-white' : 'border border-[#d9d3e6] hover:border-[#6a4be0]'}`}
                    style={hi ? { background: GRAD } : undefined}>
                    選擇 {c.name}
                  </span>
                </Link>
              </div>
            )
          })}
        </div>
        <p className="mt-3 text-[13px] text-[#6b6480]">註冊後可於後台「訂閱方案」升級。圖片／影片／主播影片／電訪／Email 等生成成本以儲值點數另計，不含在訂閱費內。</p>
      </section>

      <section className="max-w-5xl mx-auto px-6 pb-12">
        <h2 className="text-[clamp(22px,3.6vw,30px)] font-black tracking-tight mb-4">逐項功能比較</h2>
        <div className="overflow-x-auto rounded-2xl border border-[#e6e2ee] bg-white">
          <table className="w-full text-[15px] border-collapse min-w-[600px]">
            <thead>
              <tr className="bg-[#faf9fc] text-[#3f3a4d]">
                <th className="text-left font-bold py-3 px-4 sticky left-0 bg-[#faf9fc]">功能</th>
                <th className="text-center font-bold py-3 px-3">免費</th>
                <th className="text-center font-bold py-3 px-3">PRO</th>
                <th className="text-center font-bold py-3 px-3 text-[#6a4be0]">TEAM</th>
                <th className="text-center font-bold py-3 px-3">企業</th>
              </tr>
            </thead>
            <tbody>
              {COMPARISON_ROWS.map(row => (
                <tr key={row.label} className="border-t border-[#efecf5]">
                  <td className="text-left py-3 px-4 text-[#3f3a4d] whitespace-nowrap sticky left-0 bg-white">{row.label}</td>
                  {row.values.map((v, j) => (
                    <td key={j} className={`text-center py-3 px-3 font-medium ${j === 2 ? 'bg-[#6a4be0]/[0.04]' : ''}`}>{cell(v)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Link href="/intro/features" className="mt-4 inline-block text-[14px] font-bold text-[#6a4be0] hover:underline">
          不確定某個功能在做什麼？看功能詳解 →
        </Link>
      </section>

      <section className="max-w-5xl mx-auto px-6 pb-16">
        <h2 className="text-[clamp(22px,3.6vw,30px)] font-black tracking-tight mb-5">付款與計費</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {FAQ.map(f => (
            <div key={f.q} className="rounded-2xl border border-[#e6e2ee] bg-white p-5">
              <h3 className="font-extrabold text-[15px]">{f.q}</h3>
              <p className="mt-1.5 text-[15px] text-[#3f3a4d]">{f.a}</p>
            </div>
          ))}
        </div>
      </section>

      <FinalCta title={<>不用現在決定，<br />先免費用看看。</>} />
      <IntroFooter />
    </div>
  )
}
