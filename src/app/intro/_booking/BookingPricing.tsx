import { Fragment } from 'react'
import Link from 'next/link'
import type { Metadata } from 'next'
import { Check } from 'lucide-react'
import { BkDarkHeader, BkFinalCta, BkFooter, BkGradText, BK_GRAD } from './ui'
import { BK_PLANS, PLAN_NAME, PLAN_FIT, PLAN_HIGHLIGHTS, COMPARISON_GROUPS, planPrice, yearlySavePct } from './data'

export const bookingPricingMetadata: Metadata = {
  title: '方案比較｜IMT 智能訂房系統',
  description: 'IMT 智能訂房系統 FREE／CORE／PRO／MAX 方案價格與功能逐項比較。',
}

// 內容對齊 /booking/plan 的附註文案
const FAQ = [
  { q: '會自動續訂嗎？', a: '不會。付款後方案立即生效，到期前需自行再次購買延續。' },
  { q: '怎麼付款？', a: '以美金定價，結帳時依即時匯率換算為新台幣，透過綠界付款。年繳目前限時 7 折。' },
  { q: '房源不夠怎麼辦？', a: '超過基本額度的房源以加購計算（FREE 不可加購），請聯繫客服調整。房源上限請留意民宿法規，超出法定上限請自行確認執照規範。' },
  { q: '人工協助設定包含什麼？', a: '協助完成各平台通路串接與站內各項功能設定；民宿／飯店向各平台申請上架帳號不包含在內，需另外付費委託。' },
]

function cell(v: string) {
  if (v === '✓') return <Check className="h-4 w-4 mx-auto text-[#0f9d6e]" />
  if (v === '—') return <span className="text-[#cbbfb2]">—</span>
  return <span>{v}</span>
}

export function BookingPricing() {
  return (
    <div className="min-h-screen bg-[#f7f5f2] text-[#1a1612]">
      <BkDarkHeader
        eyebrow="方案比較"
        title={<>依房源數選方案，<BkGradText>免費就能開始</BkGradText></>}
        sub="官網 AI 設計、線上訂房、空房表與報表所有方案都有；升級差在房源數、定價工具與通路同步。"
      />

      {/* PLAN CARDS */}
      <section className="max-w-5xl mx-auto px-6 -mt-2 pt-10 pb-6">
        <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
          {BK_PLANS.map(p => {
            const hi = p === 'pro'
            const m = planPrice(p, 'monthly')
            const y = planPrice(p, 'yearly')
            return (
              <div key={p} className={`relative flex flex-col rounded-2xl bg-white p-5 border ${hi ? 'border-[#ef4444] shadow-[0_16px_40px_rgba(239,68,68,0.14)]' : 'border-[#e7e1d9]'}`}>
                {hi && <span className="absolute -top-2.5 left-5 text-[11px] font-bold text-white rounded-full px-2.5 py-0.5" style={{ background: BK_GRAD }}>推薦</span>}
                <div className="font-extrabold tracking-widest text-[14px]">{PLAN_NAME[p]}</div>
                <div className="text-[12.5px] text-[#5f554c] mt-1 min-h-[36px]">{PLAN_FIT[p]}</div>
                <div className="mt-3">
                  <span className="text-[36px] font-black leading-none">${m}</span>
                  <span className="text-[13px] text-[#5f554c]"> 美元／月</span>
                </div>
                <div className="text-[12px] text-[#5f554c] mt-1 min-h-[18px]">
                  {y > 0 ? <>年繳 ${y}（約 ${(y / 12).toFixed(1)}／月，省 {yearlySavePct(p)}%）</> : '永久免費'}
                </div>
                <ul className="mt-4 space-y-1.5 text-[13.5px] flex-1">
                  {PLAN_HIGHLIGHTS[p].map(f => (
                    <li key={f} className="flex gap-2"><Check className="h-4 w-4 mt-0.5 shrink-0 text-[#c2410c]" />{f}</li>
                  ))}
                </ul>
                <Link href="/register"
                  className={`mt-5 text-center font-bold text-[14px] rounded-xl py-2.5 ${hi ? 'text-white' : 'border border-[#d9d0c5] text-[#1a1612] hover:border-[#c2410c]'}`}
                  style={hi ? { background: BK_GRAD } : undefined}>
                  {p === 'free' ? '免費開始' : `選擇 ${PLAN_NAME[p]}`}
                </Link>
              </div>
            )
          })}
        </div>
      </section>

      {/* COMPARISON */}
      <section className="max-w-5xl mx-auto px-6 py-10">
        <h2 className="text-[clamp(22px,3.6vw,30px)] font-black tracking-tight mb-1">功能逐項比較</h2>
        <p className="text-[#5f554c] text-[14px] mb-5">最右欄是市場上同類訂房系統的常見狀況，供你對照。</p>
        <div className="overflow-x-auto rounded-2xl border border-[#e7e1d9] bg-white">
          <table className="w-full min-w-[720px] text-[13.5px]">
            <thead>
              <tr className="border-b border-[#e7e1d9] bg-[#faf8f5]">
                <th className="text-left font-bold px-4 py-3">功能</th>
                {BK_PLANS.map(p => (
                  <th key={p} className={`px-3 py-3 font-extrabold tracking-wider text-center ${p === 'pro' ? 'text-[#dc2626]' : ''}`}>{PLAN_NAME[p]}</th>
                ))}
                <th className="px-3 py-3 text-center font-bold text-[#8a7d70]">市場常見</th>
              </tr>
              <tr className="border-b border-[#e7e1d9] text-[12px] text-[#5f554c]">
                <td className="px-4 py-2">月繳價格（美元）</td>
                {BK_PLANS.map(p => <td key={p} className="px-3 py-2 text-center font-bold text-[#1a1612]">${planPrice(p, 'monthly')}</td>)}
                <td />
              </tr>
            </thead>
            <tbody>
              {COMPARISON_GROUPS.map(g => (
                <Fragment key={g.title}>
                  <tr className="bg-[#f7f5f2]">
                    <td colSpan={6} className="px-4 py-2 font-mono text-[11.5px] tracking-[0.14em] text-[#c2410c] font-bold">{g.title}</td>
                  </tr>
                  {g.rows.map(r => (
                    <tr key={r.label} className="border-t border-[#f1ece6]">
                      <td className="px-4 py-2.5 font-medium">{r.label}</td>
                      {r.values.map((v, i) => (
                        <td key={i} className={`px-3 py-2.5 text-center ${i === 2 ? 'bg-[#ef4444]/[0.04]' : ''}`}>{cell(v)}</td>
                      ))}
                      <td className="px-3 py-2.5 text-center text-[12px] text-[#8a7d70]">{r.market ?? '—'}</td>
                    </tr>
                  ))}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* FAQ */}
      <section className="max-w-5xl mx-auto px-6 pb-16">
        <h2 className="text-[clamp(22px,3.6vw,30px)] font-black tracking-tight mb-5">付款與方案常見問題</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {FAQ.map(f => (
            <div key={f.q} className="rounded-2xl border border-[#e7e1d9] bg-white p-5">
              <div className="font-extrabold">{f.q}</div>
              <p className="mt-1.5 text-[14px] text-[#4a4038]">{f.a}</p>
            </div>
          ))}
        </div>
        <Link href="/intro/features" className="mt-6 inline-block font-bold text-[14px] text-[#c2410c] hover:underline">看每個功能的詳細說明 →</Link>
      </section>

      <BkFinalCta title="先免費用，覺得好再升級" sub="FREE 方案含 1 房源、官網 AI 設計與 iCal 同步。" />
      <BkFooter />
    </div>
  )
}
