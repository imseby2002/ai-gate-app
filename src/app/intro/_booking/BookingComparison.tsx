// 訂房方案功能逐項比較表：費用頁與介紹頁共用
import { Fragment } from 'react'
import { Check } from 'lucide-react'
import { BK_PLANS, PLAN_NAME, COMPARISON_GROUPS as COMPARISON_GROUPS__ZH, planPrice } from './data'
import { introTr, trDeep } from '@/lib/i18n-data/server'

function cell(v: string) {
  if (v === '✓') return <Check className="h-4 w-4 mx-auto text-[#0f9d6e]" />
  if (v === '—') return <span className="text-[#cbbfb2]">—</span>
  return <span>{v}</span>
}

export async function BookingComparison() {
  const tr = await introTr()
  const COMPARISON_GROUPS = trDeep(COMPARISON_GROUPS__ZH, tr)
  return (
    <>
      {/* COMPARISON */}
      <section className="max-w-5xl mx-auto px-6 py-10">
        <h2 className="text-[clamp(22px,3.6vw,30px)] font-black tracking-tight mb-1">{tr("功能逐項比較")}</h2>
        <p className="text-[#5f554c] text-[14px] mb-5">{tr("最右欄是市場上同類訂房系統的常見狀況，供你對照。")}</p>
        <div className="overflow-x-auto rounded-2xl border border-[#e7e1d9] bg-white">
          <table className="w-full min-w-[720px] text-[13.5px]">
            <thead>
              <tr className="border-b border-[#e7e1d9] bg-[#faf8f5]">
                <th className="text-left font-bold px-4 py-3">{tr("功能")}</th>
                {BK_PLANS.map(p => (
                  <th key={p} className={`px-3 py-3 font-extrabold tracking-wider text-center ${p === 'pro' ? 'text-[#dc2626]' : ''}`}>{PLAN_NAME[p]}</th>
                ))}
                <th className="px-3 py-3 text-center font-bold text-[#8a7d70]">{tr("市場常見")}</th>
              </tr>
              <tr className="border-b border-[#e7e1d9] text-[12px] text-[#5f554c]">
                <td className="px-4 py-2">{tr("月繳價格（美元）")}</td>
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
    </>
  )
}
