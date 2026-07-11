'use client'
import { useEffect, useState } from 'react'
import { useTranslations, useLocale } from 'next-intl'
import Link from 'next/link'
import { Zap, Check, Lock } from 'lucide-react'

type BookingPlan = 'free' | 'core' | 'pro' | 'enterprise'
type Locale = 'zh-TW' | 'en' | 'vi'

const PLAN_NAME: Record<BookingPlan, string> = { free: 'FREE', core: 'CORE', pro: 'PRO', enterprise: 'MAX' }

const COPY: Record<Locale, {
  title: string; subtitle: string
  lockedText: (plan: string) => string
  upgradeBtn: string
  statusBadge: string
  eligibleNote: string
  desc: string
  channelsLabel: string
  footnote: string
  channels: string[]
}> = {
  'zh-TW': {
    title: '即時同步',
    subtitle: '秒級同步各大訂房平台的房況與訂單，避免超賣',
    lockedText: plan => `即時同步是 PRO 以上方案的功能，目前方案（${plan}）尚未開通。`,
    upgradeBtn: '升級方案',
    statusBadge: '申請開通中',
    eligibleNote: '你的方案已具備即時同步資格',
    desc: '我們會協助你完成通路串接設定，開通後訂單會秒級同步進每日入住表，不用再手動比對各平台後台。',
    channelsLabel: '支援通路',
    footnote: '開通需要協助設定，請透過「協助設定」額度或聯繫客服安排，我們會主動與你聯繫完成串接。',
    channels: ['Booking.com', 'Airbnb', 'Agoda', 'Expedia', 'Hostelworld', 'Ctrip', 'Google Hotel Search', '其他 50+ 通路'],
  },
  en: {
    title: 'Real-time Sync',
    subtitle: 'Second-level sync of availability and bookings across major channels to prevent overbooking',
    lockedText: plan => `Real-time sync is a PRO+ feature. Your current plan (${plan}) doesn't have it yet.`,
    upgradeBtn: 'Upgrade Plan',
    statusBadge: 'Application in progress',
    eligibleNote: 'Your plan is eligible for real-time sync',
    desc: 'We\'ll help you complete the channel setup. Once live, orders sync into your daily check-in sheet within seconds — no more manually checking each platform.',
    channelsLabel: 'Supported channels',
    footnote: 'Activation requires setup assistance — use your free setup credits or contact support, and we\'ll reach out to complete the connection.',
    channels: ['Booking.com', 'Airbnb', 'Agoda', 'Expedia', 'Hostelworld', 'Ctrip', 'Google Hotel Search', '50+ other channels'],
  },
  vi: {
    title: 'Đồng bộ tức thời',
    subtitle: 'Đồng bộ tình trạng phòng và đơn đặt theo giây trên các kênh lớn, tránh overbooking',
    lockedText: plan => `Đồng bộ tức thời là tính năng từ PRO trở lên. Gói hiện tại (${plan}) chưa được kích hoạt.`,
    upgradeBtn: 'Nâng cấp gói',
    statusBadge: 'Đang xử lý yêu cầu',
    eligibleNote: 'Gói của bạn đã đủ điều kiện dùng đồng bộ tức thời',
    desc: 'Chúng tôi sẽ hỗ trợ bạn hoàn tất cài đặt kết nối kênh. Sau khi kích hoạt, đơn hàng sẽ đồng bộ vào bảng nhận phòng hàng ngày trong vài giây, không cần đối chiếu thủ công từng nền tảng.',
    channelsLabel: 'Kênh hỗ trợ',
    footnote: 'Việc kích hoạt cần hỗ trợ cài đặt — dùng hạn mức "hỗ trợ cài đặt" hoặc liên hệ hỗ trợ, chúng tôi sẽ chủ động liên hệ để hoàn tất kết nối.',
    channels: ['Booking.com', 'Airbnb', 'Agoda', 'Expedia', 'Hostelworld', 'Ctrip', 'Google Hotel Search', '50+ kênh khác'],
  },
}

export default function BookingSyncPage() {
  const t = useTranslations('Booking')
  const locale = useLocale() as Locale
  const copy = COPY[locale] ?? COPY['zh-TW']
  const [plan, setPlan] = useState<BookingPlan | null>(null)
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
        <h1 className="text-xl font-bold text-gray-900">{copy.title}</h1>
        <p className="text-sm text-gray-500 mt-0.5">{copy.subtitle}</p>
      </div>

      {!eligible ? (
        <div className="bg-white rounded-xl border p-5 space-y-3 text-center">
          <Lock className="h-8 w-8 mx-auto text-gray-300" />
          <p className="text-sm text-gray-600">{copy.lockedText(PLAN_NAME[plan])}</p>
          <Link href="/booking/plan"
            className="inline-block px-4 py-2 rounded-lg text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700">
            {copy.upgradeBtn}
          </Link>
        </div>
      ) : (
        <div className="bg-white rounded-xl border p-5 space-y-4">
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-full bg-amber-50 text-amber-700 font-medium">
              <Zap className="h-3.5 w-3.5" />{copy.statusBadge}
            </span>
            <span className="text-xs text-gray-400">{copy.eligibleNote}</span>
          </div>
          <p className="text-sm text-gray-600">{copy.desc}</p>
          <div>
            <p className="text-xs font-medium text-gray-500 mb-2">{copy.channelsLabel}</p>
            <div className="flex flex-wrap gap-1.5">
              {copy.channels.map(c => (
                <span key={c} className="flex items-center gap-1 text-xs bg-gray-50 border rounded-lg px-2.5 py-1 text-gray-600">
                  <Check className="h-3 w-3 text-indigo-500" />{c}
                </span>
              ))}
            </div>
          </div>
          <p className="text-xs text-gray-400 border-t pt-3">{copy.footnote}</p>
        </div>
      )}
    </div>
  )
}
