import Link from 'next/link'
import { Check } from 'lucide-react'
import { introTr } from '@/lib/i18n-data/server'
import {
  ENTERPRISE_ADD_ONS,
  ENTERPRISE_TIERS,
  ENTERPRISE_TIER_DEFS,
  calcEnterpriseMonthlyPrice,
  calcAddOnCostToReach,
  type EnterpriseTier,
} from '@/lib/company/enterprise-plans'

// 企業方案三級（行銷／客服／訂房方案頁共用）。價格與內含量皆由 lib/company/enterprise-plans.ts 計算。
const FIT: Record<EnterpriseTier, string> = {
  core: '門市不多、用現成功能就夠的企業',
  pro: '要調整流程、報表與介面的中型企業',
  max: '需要專屬功能的大型連鎖',
}
const CUSTOM: Record<'none' | 'modify' | 'full', string> = { none: '不含客製，可按 $30／小時加購', modify: '修改現有功能', full: '開發專屬新功能' }
const ADDRESS: Record<EnterpriseTier, string> = { core: '共用平台網址', pro: '專屬子網域＋企業 Logo', max: '自有網域' }
const SUPPORT: Record<EnterpriseTier, string> = { core: '工作日回覆', pro: '優先回覆', max: '專人窗口' }

/** 套用 {n} 樣板：先把數字代入，再交給 tr（字典以樣板 key 對應） */
function fill(tpl: string, n: number | string, m?: number | string): string {
  const s = tpl.replace('{n}', String(n))
  return m === undefined ? s : s.replace('{m}', String(m))
}

export async function EnterprisePricing({ grad }: { grad: string }) {
  const tr = await introTr()
  return (
    <section className="max-w-5xl mx-auto px-6 pb-16">
      <h2 className="text-[clamp(22px,3.6vw,30px)] font-black tracking-tight">{tr('企業方案')}</h2>
      <p className="mt-2 text-[15px] text-[#3f3a4d]">{tr('全部模組一次開通，依門市與人數計價。三級皆為公開定價，需要更多用量時以加值服務加購。')}</p>

      <div className="mt-5 grid gap-3 md:grid-cols-3">
        {ENTERPRISE_TIERS.map(t => {
          const d = ENTERPRISE_TIER_DEFS[t]
          const price = calcEnterpriseMonthlyPrice(t, { stores: d.includedStores, seats: d.includedSeats })
          const hi = t === 'max'
          const items = [
            tr(fill('含 {n} 家門市', d.includedStores)) + '・' + (d.maxStores == null ? tr('門市不限') : tr(fill('上限 {n} 家門市', d.maxStores))),
            tr(fill('含 {n} 位 ERP 使用者', d.includedSeats)) + '・' + (d.maxSeats == null ? tr('人數不限') : tr(fill('上限 {n} 位使用者', d.maxSeats))),
            tr(fill('每月 {n} AI 點數', d.points)),
            tr(fill('扣點倍率：官方單價 × {n}', d.multiplier)),
            tr(CUSTOM[d.customization || 'none']) + (d.customHours > 0 ? '・' + tr(fill('每月 {n} 小時客製開發', d.customHours)) : ''),
            tr(ADDRESS[t]),
            tr(SUPPORT[t]),
          ]
          return (
            <div key={t} className={`relative rounded-2xl bg-white p-5 border flex flex-col ${hi ? 'border-[#17131f] shadow-[inset_0_0_0_1px_#17131f]' : 'border-[#e6e2ee]'}`}>
              <div className="font-extrabold tracking-widest text-[14px]">{tr(`企業 ${t.toUpperCase()}`)}</div>
              <div className="mt-2 text-[28px] font-black tabular-nums">${price.monthlyUsd.toLocaleString('en-US')}<span className="text-[14px] font-medium text-[#6b6480]">{' '}{tr('美元/月')}</span></div>
              <div className="text-[13px] text-[#6b6480]">{tr('含基本門市與人數的月費')}</div>
              <div className="text-[13px] text-[#0f9d6e] font-bold tabular-nums">
                {tr(fill('每個據點每月約 ${n}', Math.round(price.monthlyUsd / d.includedStores)))}・{tr(fill('每位使用者約 ${n}', (price.monthlyUsd / d.includedSeats).toFixed(1)))}
              </div>
              <div className="text-[13px] text-[#6b6480] tabular-nums">
                {d.yearlyMonths < 12
                  ? tr(fill('年繳 ${n}（只收 {m} 個月）', (price.monthlyUsd * d.yearlyMonths).toLocaleString('en-US'), d.yearlyMonths))
                  : tr(fill('年繳 ${n}', (price.monthlyUsd * 12).toLocaleString('en-US')))}
              </div>
              <p className="mt-3 text-[14px] text-[#3f3a4d]">{tr(FIT[t])}</p>
              <ul className="mt-3 space-y-1.5 text-[14px]">
                {items.map(f => <li key={f} className="flex gap-1.5"><Check className="h-3.5 w-3.5 shrink-0 mt-0.5 text-[#0f9d6e]" />{f}</li>)}
              </ul>
              <div className="mt-3 text-[12px] font-bold text-[#6b6480]">{tr('不另收費的服務')}</div>
              <ul className="mt-1 space-y-1 text-[13px] text-[#3f3a4d]">
                {d.perks.map(f => <li key={f} className="flex gap-1.5"><Check className="h-3 w-3 shrink-0 mt-0.5 text-[#6a4be0]" />{tr(f)}</li>)}
              </ul>
              <Link href="/register" className="mt-auto pt-4">
                <span className={`block text-center rounded-xl py-2.5 text-[14px] font-bold ${hi ? 'text-white' : 'border border-[#d9d3e6] hover:border-[#17131f]'}`}
                  style={hi ? { background: grad } : undefined}>{tr('註冊後聯絡我們開通')}</span>
              </Link>
            </div>
          )
        })}
      </div>
      {(() => {
        const maxPrice = calcEnterpriseMonthlyPrice('max', { stores: ENTERPRISE_TIER_DEFS.max.includedStores, seats: ENTERPRISE_TIER_DEFS.max.includedSeats }).monthlyUsd
        const proToMax = calcAddOnCostToReach('pro', 'max')
        return proToMax > maxPrice ? (
          <div className="mt-4 rounded-2xl border border-[#e6e2ee] bg-white p-4 text-[14px] text-[#3f3a4d]">
            <span className="font-extrabold text-[#17131f]">{tr('為什麼選 MAX：')}</span>
            {tr(fill('用 PRO 加購到 MAX 的內含量（30 個據點、100 人、10 小時客製、400 點）要 ${n}，比 MAX 的 ${m} 還貴；MAX 另外還有專屬新功能、自有網域、專人窗口與較低的扣點倍率。', proToMax.toLocaleString('en-US'), maxPrice.toLocaleString('en-US')))}
          </div>
        ) : null
      })()}
      <p className="mt-3 text-[13px] text-[#6b6480]">{tr('超出含量的門市每家 $10、ERP 使用者每人 $2；CORE、PRO 有上限。門市沒用滿時，每 1 家可換 5 位使用者（沒有門市的企業可多用人數）。以美元計價，未含稅。')}</p>

      <h3 className="mt-8 mb-3 text-[18px] font-black">{tr('加值服務')}</h3>
      <div className="overflow-x-auto rounded-2xl border border-[#e6e2ee] bg-white">
        <table className="w-full text-[14px] border-collapse min-w-[720px]">
          <thead>
            <tr className="bg-[#faf9fc] text-[#3f3a4d]">
              <th className="text-left font-bold py-3 px-4">{tr('服務')}</th>
              <th className="text-left font-bold py-3 px-3">{tr('單價')}</th>
              <th className="text-center font-bold py-3 px-3">CORE</th>
              <th className="text-center font-bold py-3 px-3">PRO</th>
              <th className="text-center font-bold py-3 px-3">MAX</th>
            </tr>
          </thead>
          <tbody>
            {ENTERPRISE_ADD_ONS.map(a => (
              <tr key={a.key} className="border-t border-[#efecf5]">
                <td className="text-left py-3 px-4 text-[#3f3a4d]">{tr(a.label)}</td>
                <td className="text-left py-3 px-3 text-[#3f3a4d]">{tr(a.unit)}</td>
                {ENTERPRISE_TIERS.map(t => (
                  <td key={t} className="text-center py-3 px-3 font-medium">{a.included[t] === '—' ? <span className="text-[#c9c3d6]">—</span> : tr(a.included[t])}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}
