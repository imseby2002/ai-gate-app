'use client'
import { useTranslations } from 'next-intl'
import { Check, X, Sparkles } from 'lucide-react'

const PLAN_CARDS = [
  {
    id: 'free', name: '免費', price: '$0', unit: '', highlight: false,
    features: ['1 房源（不可加購）', '官網 AI 設計', 'iCal 同步'],
  },
  {
    id: 'core', name: 'CORE', price: '$5', unit: '美元/月', highlight: false,
    features: ['5 房源（+$4/房源）', '1 位協作者', '動態定價規則', 'Email 同步（OTA信件轉單）'],
  },
  {
    id: 'pro', name: 'PRO', price: '$19', unit: '美元/月', highlight: true,
    features: ['5 房源（+$3/房源）', '2 位協作者', '即時同步 60+ 平台（秒級防超賣）', '與 CS 串接（訂單密碼連動）', '每月 1 次免費協助設定'],
  },
  {
    id: 'enterprise', name: '企業', price: '$39', unit: '美元/月起', highlight: false,
    features: ['15 房源（+$2/房源）', '無上限協作者', '動態定價客製規則', '每月 2 次免費協助設定'],
  },
] as const

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

  return (
    <div className="p-4 md:p-6 pb-16 space-y-6 max-w-5xl">
      <div>
        <h1 className="text-xl font-bold text-gray-900">{t('plan.title')}</h1>
        <p className="text-sm text-gray-500 mt-0.5">{t('plan.subtitle')}</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {PLAN_CARDS.map(c => (
          <div key={c.id}
            className={`rounded-xl border p-4 space-y-3 ${c.highlight ? 'border-indigo-500 bg-indigo-50/40 ring-1 ring-indigo-500' : 'bg-white'}`}>
            <div className="flex items-center justify-between">
              <span className="text-sm font-bold text-gray-900">{c.name}</span>
              {c.highlight && (
                <span className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-indigo-600 text-white font-medium">
                  <Sparkles className="h-3 w-3" />推薦
                </span>
              )}
            </div>
            <div>
              <span className="text-2xl font-bold text-gray-900">{c.price}</span>
              {c.unit && <span className="text-xs text-gray-500 ml-1">{c.unit}</span>}
            </div>
            <ul className="text-xs text-gray-600 space-y-1.5">
              {c.features.map(f => (
                <li key={f} className="flex items-start gap-1.5">
                  <Check className="h-3.5 w-3.5 mt-0.5 text-indigo-500 shrink-0" />
                  <span>{f}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

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
      <p className="text-[11px] text-gray-400">訂閱與升級功能即將開放，敬請期待。</p>
    </div>
  )
}
