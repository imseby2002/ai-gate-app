'use client'
import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import Link from 'next/link'
import { Zap, Check, Lock } from 'lucide-react'

const CHANNELS = ['Booking.com', 'Airbnb', 'Agoda', 'Expedia', 'Hostelworld', 'Ctrip', 'Google Hotel Search', '其他 50+ 通路']

export default function BookingSyncPage() {
  const t = useTranslations('Booking')
  const [plan, setPlan] = useState<string | null>(null)
  const [eligible, setEligible] = useState(false)

  useEffect(() => {
    fetch('/api/booking/plan').then(r => r.json()).then(d => {
      setPlan(d.plan ?? 'free')
      setEligible(!!d.features?.realtimeSync)
    }).catch(() => { setPlan('free'); setEligible(false) })
  }, [])

  if (plan == null) return <div className="p-6 text-gray-400 text-sm">{t('common.loading')}</div>

  return (
    <div className="p-4 md:p-6 pb-16 max-w-2xl space-y-5">
      <div>
        <h1 className="text-xl font-bold text-gray-900">即時同步</h1>
        <p className="text-sm text-gray-500 mt-0.5">秒級同步各大訂房平台的房況與訂單，避免超賣</p>
      </div>

      {!eligible ? (
        <div className="bg-white rounded-xl border p-5 space-y-3 text-center">
          <Lock className="h-8 w-8 mx-auto text-gray-300" />
          <p className="text-sm text-gray-600">即時同步是 PRO 以上方案的功能，目前方案（{plan === 'free' ? '免費' : plan.toUpperCase()}）尚未開通。</p>
          <Link href="/booking/plan"
            className="inline-block px-4 py-2 rounded-lg text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700">
            升級方案
          </Link>
        </div>
      ) : (
        <div className="bg-white rounded-xl border p-5 space-y-4">
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-full bg-amber-50 text-amber-700 font-medium">
              <Zap className="h-3.5 w-3.5" />申請開通中
            </span>
            <span className="text-xs text-gray-400">你的方案已具備即時同步資格</span>
          </div>
          <p className="text-sm text-gray-600">
            我們會協助你完成通路串接設定，開通後訂單會秒級同步進每日入住表，不用再手動比對各平台後台。
          </p>
          <div>
            <p className="text-xs font-medium text-gray-500 mb-2">支援通路</p>
            <div className="flex flex-wrap gap-1.5">
              {CHANNELS.map(c => (
                <span key={c} className="flex items-center gap-1 text-xs bg-gray-50 border rounded-lg px-2.5 py-1 text-gray-600">
                  <Check className="h-3 w-3 text-indigo-500" />{c}
                </span>
              ))}
            </div>
          </div>
          <p className="text-xs text-gray-400 border-t pt-3">
            開通需要協助設定，請透過「協助設定」額度或聯繫客服安排，我們會主動與你聯繫完成串接。
          </p>
        </div>
      )}
    </div>
  )
}
