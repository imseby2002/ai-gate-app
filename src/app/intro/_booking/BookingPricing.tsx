import Link from 'next/link'
import type { Metadata } from 'next'
import { Check } from 'lucide-react'
import { BkDarkHeader, BkFinalCta, BkFooter, BkGradText, BK_GRAD } from './ui'
import { BK_PLANS, PLAN_NAME, PLAN_FIT as PLAN_FIT__ZH, PLAN_HIGHLIGHTS as PLAN_HIGHLIGHTS__ZH, planPrice, yearlySavePct } from './data'
import { introTr, trDeep } from '@/lib/i18n-data/server'
import { EnterprisePricing } from '../pricing/EnterprisePricing'
import { BookingComparison } from './BookingComparison'

export const bookingPricingMetadata: Metadata = {
  title: '方案比較｜IMT 智能訂房系統',
  description: 'IMT 智能訂房系統 FREE／CORE／PRO／MAX 方案價格與功能逐項比較。',
}

// 內容對齊 /booking/plan 的附註文案
const FAQ__ZH = [
  { q: '會自動續訂嗎？', a: '不會。付款後方案立即生效，到期前需自行再次購買延續。' },
  { q: '怎麼付款？', a: '以美金定價，結帳時依即時匯率換算為新台幣，透過綠界付款。年繳目前限時 7 折。' },
  { q: '房源不夠怎麼辦？', a: '超過基本額度的房源以加購計算（FREE 不可加購），請聯繫客服調整。房源上限請留意民宿法規，超出法定上限請自行確認執照規範。' },
  { q: '人工協助設定包含什麼？', a: '協助完成各平台通路串接與站內各項功能設定；民宿／飯店向各平台申請上架帳號不包含在內，需另外付費委託。' },
]

export async function BookingPricing() {
  const tr = await introTr()
  const PLAN_FIT = trDeep(PLAN_FIT__ZH, tr)
  const PLAN_HIGHLIGHTS = trDeep(PLAN_HIGHLIGHTS__ZH, tr)
  const FAQ = trDeep(FAQ__ZH, tr)
  return (
    <div className="min-h-screen bg-[#f7f5f2] text-[#1a1612]">
      <BkDarkHeader
        eyebrow={tr("方案比較")}
        title={<>{tr("依房源數選方案，")}<BkGradText>{tr("免費就能開始")}</BkGradText></>}
        sub={tr("官網模板、線上訂房、空房表、動態定價與報表所有方案都有；升級差在房源數、AI 官網設計與通路同步。")}
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
                {hi && <span className="absolute -top-2.5 left-5 text-[11px] font-bold text-white rounded-full px-2.5 py-0.5" style={{ background: BK_GRAD }}>{tr("推薦")}</span>}
                <div className="font-extrabold tracking-widest text-[14px]">{PLAN_NAME[p]}</div>
                <div className="text-[12.5px] text-[#5f554c] mt-1 min-h-[36px]">{PLAN_FIT[p]}</div>
                <div className="mt-3">
                  <span className="text-[36px] font-black leading-none">${m}</span>
                  <span className="text-[13px] text-[#5f554c]">{" "}{tr("美元／月")}</span>
                </div>
                <div className="text-[12px] text-[#5f554c] mt-1 min-h-[18px]">
                  {y > 0 ? <>{tr("年繳 $")}{y}{tr("（約 $")}{(y / 12).toFixed(1)}{tr("／月，省")}{" "}{yearlySavePct(p)}%）</> : tr("永久免費")}
                </div>
                <ul className="mt-4 space-y-1.5 text-[13.5px] flex-1">
                  {PLAN_HIGHLIGHTS[p].map(f => (
                    <li key={f} className="flex gap-2"><Check className="h-4 w-4 mt-0.5 shrink-0 text-[#c2410c]" />{f}</li>
                  ))}
                </ul>
                <Link href="/register"
                  className={`mt-5 text-center font-bold text-[14px] rounded-xl py-2.5 ${hi ? 'text-white' : 'border border-[#d9d0c5] text-[#1a1612] hover:border-[#c2410c]'}`}
                  style={hi ? { background: BK_GRAD } : undefined}>
                  {p === 'free' ? tr("免費開始") : tr(`選擇 ${PLAN_NAME[p]}`)}
                </Link>
              </div>
            )
          })}
        </div>
      </section>

      <BookingComparison />

      {/* FAQ */}
      <section className="max-w-5xl mx-auto px-6 pb-16">
        <h2 className="text-[clamp(22px,3.6vw,30px)] font-black tracking-tight mb-5">{tr("付款與方案常見問題")}</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {FAQ.map(f => (
            <div key={f.q} className="rounded-2xl border border-[#e7e1d9] bg-white p-5">
              <div className="font-extrabold">{f.q}</div>
              <p className="mt-1.5 text-[14px] text-[#4a4038]">{f.a}</p>
            </div>
          ))}
        </div>
        <Link href="/intro/features" className="mt-6 inline-block font-bold text-[14px] text-[#c2410c] hover:underline">{tr("看每個功能的詳細說明 →")}</Link>
      </section>

      <EnterprisePricing grad={BK_GRAD} />

      <BkFinalCta title={tr("先免費用，覺得好再升級")} sub={tr("FREE 方案含 5 房源、官網固定模板、iCal 同步、動態定價、優惠碼與客服串接。")} />
      <BkFooter />
    </div>
  )
}
