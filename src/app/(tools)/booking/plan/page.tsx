'use client'
import { useCallback, useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Check, X, Sparkles, Loader2 } from 'lucide-react'

type BookingPlan = 'free' | 'core' | 'pro' | 'enterprise'
type Cycle = 'monthly' | 'yearly'

const PLAN_CARDS = [
  {
    id: 'free' as BookingPlan, name: '免費', monthlyUsd: 0, yearlyUsd: 0, highlight: false,
    monthlyId: undefined as string | undefined, yearlyId: undefined as string | undefined,
    features: ['1 房源（不可加購）', '官網 AI 設計', 'iCal 同步'],
  },
  {
    id: 'core' as BookingPlan, name: 'CORE', monthlyUsd: 5, yearlyUsd: 46, highlight: false,
    monthlyId: 'core_monthly', yearlyId: 'core_yearly',
    features: ['5 房源（+$4/房源）', '1 位協作者', '動態定價規則', 'Email 同步（OTA信件轉單）'],
  },
  {
    id: 'pro' as BookingPlan, name: 'PRO', monthlyUsd: 19, yearlyUsd: 182, highlight: true,
    monthlyId: 'pro_monthly', yearlyId: 'pro_yearly',
    features: ['5 房源（+$3/房源）', '2 位協作者', '即時同步 60+ 平台（秒級防超賣）', '與 CS 串接（訂單密碼連動）', '每月 1 次免費協助設定'],
  },
  {
    id: 'enterprise' as BookingPlan, name: '企業', monthlyUsd: 39, yearlyUsd: 374, highlight: false,
    monthlyId: 'enterprise_monthly', yearlyId: 'enterprise_yearly',
    features: ['15 房源（+$2/房源）', '無上限協作者', '動態定價客製規則', '每月 2 次免費協助設定'],
  },
]

const COMPARISON_ROWS: Array<{ label: string; values: [string, string, string, string] }> = [
  { label: '房源數（基本＋加購）', values: ['1（不可加購）', '5（+$4/房源）', '5（+$3/房源）', '15（+$2/房源）'] },
  { label: '協作者', values: ['0', '1', '2', '無上限'] },
  { label: '動態定價規則', values: ['—', '✓', '✓', '✓＋客製規則'] },
  { label: '官網 AI 設計', values: ['✓', '✓', '✓', '✓'] },
  { label: 'iCal 同步（備援，非即時）', values: ['✓', '✓', '✓', '✓'] },
  { label: 'Email 同步（OTA信件轉單，備援）', values: ['—', '✓', '✓', '✓'] },
  { label: '即時同步 60+ 平台（秒級防超賣）', values: ['—', '—', '✓（全房源皆含）', '✓（全房源皆含）'] },
  { label: '與 CS 串接（訂單密碼連動）', values: ['—', '—', '✓', '✓'] },
  { label: '人工協助設置（超額單價 $20）', values: ['0 次/月', '0 次/月', '1 次/月', '2 次/月'] },
]

export default function BookingPlanPage() {
  const t = useTranslations('Booking')
  const [plan, setPlan] = useState<BookingPlan | null>(null)
  const [propertyLimit, setPropertyLimit] = useState<number | null>(null)
  const [cycle, setCycle] = useState<Cycle>('yearly')
  const [checkingOut, setCheckingOut] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/booking/plan')
      const data = await res.json()
      setPlan(data.plan ?? 'free')
      setPropertyLimit(data.propertyLimit ?? 1)
    } catch { setPlan('free'); setPropertyLimit(1) }
  }, [])

  useEffect(() => { load() }, [load])

  const upgrade = async (packageId: string) => {
    setCheckingOut(packageId)
    try {
      const res = await fetch('/api/billing/create-booking-plan-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ packageId }),
      })
      const data = await res.json()
      if (!res.ok) { alert(data.error ?? '建立訂單失敗'); return }

      const form = document.createElement('form')
      form.method = 'POST'
      form.action = data.paymentUrl
      form.target = '_blank'
      for (const [key, value] of Object.entries(data.params as Record<string, string>)) {
        const input = document.createElement('input')
        input.type = 'hidden'
        input.name = key
        input.value = String(value)
        form.appendChild(input)
      }
      document.body.appendChild(form)
      form.submit()
      document.body.removeChild(form)
    } catch {
      alert('網路錯誤，請稍後再試')
    } finally {
      setCheckingOut(null)
    }
  }

  if (plan == null) return <div className="p-6 text-gray-400 text-sm">{t('common.loading')}</div>

  return (
    <div className="p-4 md:p-6 pb-16 space-y-6 max-w-5xl">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-xl font-bold text-gray-900">{t('plan.title')}</h1>
          <p className="text-sm text-gray-500 mt-0.5">{t('plan.subtitle')}</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-600 font-medium">
            目前：{plan === 'free' ? '免費' : plan.toUpperCase()}（房源上限 {propertyLimit}）
          </span>
          <div className="flex gap-1 text-xs">
            <button onClick={() => setCycle('yearly')}
              className={`px-2.5 py-1 rounded-lg ${cycle === 'yearly' ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-500'}`}>
              年繳（約 8 折）
            </button>
            <button onClick={() => setCycle('monthly')}
              className={`px-2.5 py-1 rounded-lg ${cycle === 'monthly' ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-500'}`}>
              月繳
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {PLAN_CARDS.map(c => {
          const isCurrent = plan === c.id
          const isFree = c.id === 'free'
          const packageId = cycle === 'monthly' ? c.monthlyId : c.yearlyId
          const yearlyMonthlyEquiv = c.yearlyUsd / 12
          const savingsPct = c.monthlyUsd > 0 ? Math.round((1 - c.yearlyUsd / (c.monthlyUsd * 12)) * 100) : 0

          return (
            <div key={c.id}
              className={`rounded-xl border p-4 space-y-3 ${c.highlight ? 'border-indigo-500 bg-indigo-50/40 ring-1 ring-indigo-500' : 'bg-white'} ${isCurrent ? 'ring-1 ring-green-500 border-green-500' : ''}`}>
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold text-gray-900">{c.name}</span>
                {isCurrent ? (
                  <span className="flex items-center gap-1 text-[10px] text-green-600 font-medium"><Check className="h-3 w-3" />使用中</span>
                ) : c.highlight && (
                  <span className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-indigo-600 text-white font-medium">
                    <Sparkles className="h-3 w-3" />推薦
                  </span>
                )}
              </div>

              {isFree ? (
                <div className="text-2xl font-bold text-gray-900">$0</div>
              ) : cycle === 'monthly' ? (
                <div className="text-2xl font-bold text-gray-900">
                  ${c.monthlyUsd} <span className="text-xs font-normal text-gray-500">美元/月</span>
                </div>
              ) : (
                <div className="space-y-0.5">
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-xs line-through text-gray-400">${c.monthlyUsd}</span>
                    <span className="text-2xl font-bold text-gray-900">${yearlyMonthlyEquiv.toFixed(2)}</span>
                    <span className="text-xs font-normal text-gray-500">美元/月</span>
                    {savingsPct > 0 && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-green-100 text-green-700 font-medium">省 {savingsPct}%</span>}
                  </div>
                  <div className="text-[10px] text-gray-400">年繳 ${c.yearlyUsd} 美元</div>
                </div>
              )}

              <ul className="text-xs text-gray-600 space-y-1.5">
                {c.features.map(f => (
                  <li key={f} className="flex items-start gap-1.5">
                    <Check className="h-3.5 w-3.5 mt-0.5 text-indigo-500 shrink-0" />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>

              {!isFree && (
                <button
                  onClick={() => upgrade(packageId!)}
                  disabled={isCurrent || checkingOut === packageId}
                  className="w-full mt-1 py-2 rounded-lg text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-1.5"
                >
                  {checkingOut === packageId ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                  {isCurrent ? '目前方案' : '升級'}
                </button>
              )}
            </div>
          )
        })}
      </div>

      <p className="text-[11px] text-gray-400">付款後方案立即生效，到期前不會自動續訂，需自行再次購買延續。房源加購請聯繫客服調整。</p>

      <div className="overflow-x-auto rounded-xl border bg-white">
        <table className="w-full text-xs border-collapse min-w-[640px]">
          <thead>
            <tr className="bg-gray-50 border-b">
              <th className="text-left font-medium py-2.5 px-3 text-gray-500">功能</th>
              <th className="text-center font-medium py-2.5 px-3 text-gray-500">免費</th>
              <th className="text-center font-medium py-2.5 px-3 text-gray-500">CORE</th>
              <th className="text-center font-medium py-2.5 px-3 text-gray-500">PRO</th>
              <th className="text-center font-medium py-2.5 px-3 text-gray-500">企業</th>
            </tr>
          </thead>
          <tbody>
            {COMPARISON_ROWS.map(row => (
              <tr key={row.label} className="border-b last:border-0">
                <td className="text-left py-2.5 px-3 text-gray-600">{row.label}</td>
                {row.values.map((v, i) => (
                  <td key={i} className="text-center py-2.5 px-3 text-gray-900">
                    {v === '✓' ? <Check className="h-3.5 w-3.5 mx-auto text-indigo-500" /> : v === '—' ? <X className="h-3.5 w-3.5 mx-auto text-gray-300" /> : v}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-[11px] text-gray-400">
        房源數超過基本額度以加購方式計算；房源上限請留意民宿法規（一般地區最多 8 間，原住民族地區／休閒農場／休閒農業區／觀光地區／偏遠地區／離島最多 15 間），超出法定上限請自行確認執照規範。
      </p>
    </div>
  )
}
