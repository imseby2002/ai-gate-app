import { Fragment } from 'react'
import Link from 'next/link'
import type { Metadata } from 'next'
import { Check } from 'lucide-react'
import { CsDarkHeader, CsFinalCta, CsFooter, CsGradText, CS_GRAD } from './ui'
import { CS_PLANS, PLAN_NAME, PLAN_FIT, PLAN_HIGHLIGHTS, COMPARISON_GROUPS, CS_FEATURE_REQUEST_PRICING, planPrice, yearlySavePct } from './data'

export const csPricingMetadata: Metadata = {
  title: '方案價格｜IMT 智能客服',
  description: 'IMT 智能客服 FREE／CORE／PRO／MAX 方案價格與功能逐項比較。所有方案不限訊息則數。',
}

const FAQ = [
  { q: '所有方案都不限訊息則數？', a: '是，FREE 也一樣。方案差別在平台數、協作人數與進階功能，不在用量。' },
  { q: '會自動續訂嗎？', a: '結帳時可自行選擇是否自動扣款；沒勾選就不會自動續訂，到期前需要再自行購買延續。付款後方案立即生效。' },
  { q: '怎麼付款？', a: '以美金定價，結帳時依即時匯率換算為新台幣，透過綠界付款。' },
  { q: '可以中途升級嗎？', a: '可以，隨時在客服後台「訂閱方案」頁升級。方案升級需由業者（擁有者）本人操作。' },
]

function cell(v: string) {
  if (v === '✓') return <Check className="h-4 w-4 mx-auto text-[#0f9d6e]" />
  if (v === '—') return <span className="text-[#b9c6ce]">—</span>
  return <span>{v}</span>
}

export function CsPricing() {
  return (
    <div className="min-h-screen bg-[#f3f6f8] text-[#0f1720]">
      <CsDarkHeader
        eyebrow="方案價格"
        title={<>不按則數收費，<CsGradText>用越多越划算</CsGradText></>}
        sub="市場常見的 AI 客服每月只給 50–100 則，超過就加價。這裡每個方案都不限則數，價格固定。"
      />

      {/* PLAN CARDS */}
      <section className="max-w-5xl mx-auto px-6 -mt-2 pt-10 pb-6">
        <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
          {CS_PLANS.map(p => {
            const hi = p === 'core'
            const m = planPrice(p, 'monthly')
            const y = planPrice(p, 'yearly')
            return (
              <div key={p} className={`relative flex flex-col rounded-2xl bg-white p-5 border ${hi ? 'border-[#2563eb] shadow-[0_16px_40px_rgba(37,99,235,0.16)]' : 'border-[#dde5ea]'}`}>
                {hi && <span className="absolute -top-2.5 left-5 text-[11px] font-bold text-white rounded-full px-2.5 py-0.5" style={{ background: CS_GRAD }}>最多人選</span>}
                <div className="font-extrabold tracking-widest text-[14px]">{PLAN_NAME[p]}</div>
                <div className="text-[12.5px] text-[#56646d] mt-1 min-h-[36px]">{PLAN_FIT[p]}</div>
                <div className="mt-3">
                  <span className="text-[36px] font-black leading-none">${m}</span>
                  <span className="text-[13px] text-[#56646d]"> 美元／月</span>
                </div>
                <div className="text-[12px] text-[#56646d] mt-1 min-h-[18px]">
                  {y > 0 ? <>年繳 ${y}（約 ${(y / 12).toFixed(1)}／月，省 {yearlySavePct(p)}%）</> : '永久免費'}
                </div>
                <ul className="mt-4 space-y-1.5 text-[13.5px] flex-1">
                  {PLAN_HIGHLIGHTS[p].map(f => (
                    <li key={f} className="flex gap-2"><Check className="h-4 w-4 mt-0.5 shrink-0 text-[#0d8f8e]" />{f}</li>
                  ))}
                </ul>
                <Link href="/register"
                  className={`mt-5 text-center font-bold text-[14px] rounded-xl py-2.5 ${hi ? 'text-white' : 'border border-[#cfd9df] text-[#0f1720] hover:border-[#0d8f8e]'}`}
                  style={hi ? { background: CS_GRAD } : undefined}>
                  {p === 'free' ? '免費開始' : `選擇 ${PLAN_NAME[p]}`}
                </Link>
              </div>
            )
          })}
        </div>
        <p className="mt-3 text-[12px] text-[#7b8a94]">新升級 CORE 的會員，首次協助設定免費（每個帳號一次，不分月繳／年繳）。</p>
      </section>

      {/* COMPARISON */}
      <section className="max-w-5xl mx-auto px-6 py-10">
        <h2 className="text-[clamp(22px,3.6vw,30px)] font-black tracking-tight mb-1">功能逐項比較</h2>
        <p className="text-[#56646d] text-[14px] mb-5">最右欄是市場上常見的 AI 客服做法，供你對照。</p>
        <div className="overflow-x-auto rounded-2xl border border-[#dde5ea] bg-white">
          <table className="w-full min-w-[680px] text-[13.5px]">
            <thead>
              <tr className="border-b border-[#dde5ea] bg-[#f7fafb]">
                <th className="text-left font-bold px-4 py-3">功能</th>
                {CS_PLANS.map(p => (
                  <th key={p} className={`px-3 py-3 font-extrabold tracking-wider text-center ${p === 'core' ? 'text-[#2563eb]' : ''}`}>{PLAN_NAME[p]}</th>
                ))}
                <th className="px-3 py-3 text-center font-bold text-[#7b8a94]">市場常見</th>
              </tr>
              <tr className="border-b border-[#dde5ea] text-[12px] text-[#56646d]">
                <td className="px-4 py-2">月繳價格（美元）</td>
                {CS_PLANS.map(p => <td key={p} className="px-3 py-2 text-center font-bold text-[#0f1720]">${planPrice(p, 'monthly')}</td>)}
                <td />
              </tr>
            </thead>
            <tbody>
              {COMPARISON_GROUPS.map(g => (
                <Fragment key={g.title}>
                  <tr className="bg-[#f3f6f8]">
                    <td colSpan={6} className="px-4 py-2 font-mono text-[11.5px] tracking-[0.14em] text-[#0d8f8e] font-bold">{g.title}</td>
                  </tr>
                  {g.rows.map(r => (
                    <tr key={r.label} className="border-t border-[#eef2f4]">
                      <td className="px-4 py-2.5 font-medium">{r.label}</td>
                      {r.values.map((v, i) => (
                        <td key={i} className={`px-3 py-2.5 text-center ${i === 1 ? 'bg-[#2563eb]/[0.04]' : ''}`}>{cell(v)}</td>
                      ))}
                      <td className="px-3 py-2.5 text-center text-[12px] text-[#7b8a94]">{r.market ?? '—'}</td>
                    </tr>
                  ))}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-2 text-[13px] text-[#3d4a52]">
          <div className="rounded-2xl bg-white border border-[#dde5ea] p-4">
            <div className="font-extrabold text-[14px] text-[#0f1720] mb-1">協助設定包含什麼？</div>
            站內所有設定（資料來源、報價計算機等）與各平台串接設定；不包含知識庫內容建立，以及 LINE、WhatsApp 等官方帳號本身的申請，這兩項另外報價。
          </div>
          <div className="rounded-2xl bg-white border border-[#dde5ea] p-4">
            <div className="font-extrabold text-[14px] text-[#0f1720] mb-1">需要方案裡沒有的功能？</div>
            基礎客製（調整既有邏輯、不動資料庫結構，{CS_FEATURE_REQUEST_PRICING.basicNote}）依上表計價。複雜客製：{CS_FEATURE_REQUEST_PRICING.complexNote}。
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="max-w-5xl mx-auto px-6 pb-16">
        <h2 className="text-[clamp(22px,3.6vw,30px)] font-black tracking-tight mb-5">付款與方案常見問題</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {FAQ.map(f => (
            <div key={f.q} className="rounded-2xl border border-[#dde5ea] bg-white p-5">
              <div className="font-extrabold">{f.q}</div>
              <p className="mt-1.5 text-[14px] text-[#3d4a52]">{f.a}</p>
            </div>
          ))}
        </div>
        <Link href="/intro/features" className="mt-6 inline-block font-bold text-[14px] text-[#0d8f8e] hover:underline">看每個功能的詳細說明 →</Link>
      </section>

      <CsFinalCta title="先免費用，覺得好再升級" sub="FREE 方案即可串接 3 個平台，不限訊息則數。" />
      <CsFooter />
    </div>
  )
}
