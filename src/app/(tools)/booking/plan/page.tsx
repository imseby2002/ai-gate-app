'use client'
import { useCallback, useEffect, useState } from 'react'
import { useTranslations, useLocale } from 'next-intl'
import { Check, X, Sparkles, Loader2 } from 'lucide-react'

type BookingPlan = 'free' | 'core' | 'pro' | 'enterprise'
type Cycle = 'monthly' | 'yearly'
type Locale = 'zh-TW' | 'en' | 'vi'

// 方案名稱固定用英文，不隨語系翻譯
const PLAN_NAME: Record<BookingPlan, string> = { free: 'FREE', core: 'CORE', pro: 'PRO', enterprise: 'MAX' }

const PLAN_META = [
  { id: 'free' as BookingPlan, monthlyUsd: 0, yearlyUsd: 0, highlight: false, monthlyId: undefined as string | undefined, yearlyId: undefined as string | undefined },
  { id: 'core' as BookingPlan, monthlyUsd: 5, yearlyUsd: 54, highlight: false, monthlyId: 'core_monthly', yearlyId: 'core_yearly' },
  { id: 'pro' as BookingPlan, monthlyUsd: 19, yearlyUsd: 205, highlight: true, monthlyId: 'pro_monthly', yearlyId: 'pro_yearly' },
  { id: 'enterprise' as BookingPlan, monthlyUsd: 39, yearlyUsd: 421, highlight: false, monthlyId: 'enterprise_monthly', yearlyId: 'enterprise_yearly' },
]

interface Copy {
  currentBadge: (plan: string, limit: number) => string
  cycleYearly: string
  cycleMonthly: string
  perMonthUnit: string
  yearlyTotal: (amt: number) => string
  savePct: (pct: number) => string
  current: string
  recommended: string
  upgrade: string
  currentPlanBtn: string
  checkoutFailed: string
  networkError: string
  footnote1: string
  legalNote: string
  assistScopeNote: string
  featureCol: string
  cards: Record<BookingPlan, string[]>
  rows: Array<{ label: string; values: [string, string, string, string] }>
}

const COPY: Record<Locale, Copy> = {
  'zh-TW': {
    currentBadge: (plan, limit) => `目前：${plan}（房源上限 ${limit}）`,
    cycleYearly: '年繳（約 9 折）',
    cycleMonthly: '月繳',
    perMonthUnit: '美元/月',
    yearlyTotal: amt => `年繳 $${amt} 美元`,
    savePct: pct => `省 ${pct}%`,
    current: '使用中',
    recommended: '推薦',
    upgrade: '升級',
    currentPlanBtn: '目前方案',
    checkoutFailed: '建立訂單失敗',
    networkError: '網路錯誤，請稍後再試',
    footnote1: '付款後方案立即生效，到期前不會自動續訂，需自行再次購買延續。房源加購請聯繫客服調整。',
    legalNote: '房源數超過基本額度以加購方式計算；房源上限請留意民宿法規，超出法定上限請自行確認執照規範。',
    assistScopeNote: '「人工協助設置」範圍：協助完成各平台通路串接與本站內各項功能設定；民宿／飯店向各平台申請上架帳號不含在協助設置內，需另外付費委託。',
    featureCol: '功能',
    cards: {
      free: ['1 房源（不可加購）', '官網 AI 設計', 'iCal 同步'],
      core: ['5 房源（+$4/房源）', '1 位協作者', '動態定價規則', '優惠碼', 'Email 同步（OTA信件轉單）'],
      pro: ['5 房源（+$3/房源）', '2 位協作者', '優惠碼', '即時同步 60+ 平台（秒級防超賣）', '與 CS 串接（訂單密碼連動）', '每月 1 次免費協助設定'],
      enterprise: ['15 房源（+$2/房源）', '無上限協作者', '動態定價客製規則', '優惠碼', '每月 2 次免費協助設定'],
    },
    rows: [
      { label: '房源數（基本＋加購）', values: ['1（不可加購）', '5（+$4/房源）', '5（+$3/房源）', '15（+$2/房源）'] },
      { label: '協作者', values: ['0', '1', '2', '無上限'] },
      { label: '動態定價規則', values: ['—', '✓', '✓', '✓＋客製規則'] },
      { label: '優惠碼', values: ['—', '✓', '✓', '✓'] },
      { label: '官網 AI 設計', values: ['✓', '✓', '✓', '✓'] },
      { label: 'iCal 同步（備援，非即時）', values: ['✓', '✓', '✓', '✓'] },
      { label: 'Email 同步（OTA信件轉單，備援）', values: ['—', '✓', '✓', '✓'] },
      { label: '即時同步 60+ 平台（秒級防超賣）', values: ['—', '—', '✓（全房源皆含）', '✓（全房源皆含）'] },
      { label: '與 CS 串接（訂單密碼連動）', values: ['—', '—', '✓', '✓'] },
      { label: '人工協助設置（超額單價 $20）', values: ['0 次/月', '0 次/月', '1 次/月', '2 次/月'] },
    ],
  },
  en: {
    currentBadge: (plan, limit) => `Current: ${plan} (property limit ${limit})`,
    cycleYearly: 'Yearly (~10% off)',
    cycleMonthly: 'Monthly',
    perMonthUnit: 'USD/mo',
    yearlyTotal: amt => `$${amt}/year`,
    savePct: pct => `Save ${pct}%`,
    current: 'Current',
    recommended: 'Recommended',
    upgrade: 'Upgrade',
    currentPlanBtn: 'Current Plan',
    checkoutFailed: 'Failed to create order',
    networkError: 'Network error, please try again later',
    footnote1: 'Your plan activates immediately after payment and does not auto-renew — repurchase before it expires to continue. Contact support to add extra properties.',
    legalNote: 'Properties beyond the base allowance are billed as add-ons. Please note local B&B regulations on room limits — confirm your license\'s actual limit if you exceed these.',
    assistScopeNote: '"Setup assist" covers: connecting OTA channels and configuring in-app features. It does not include applying for new listing accounts on OTA platforms — that\'s a separate paid service.',
    featureCol: 'Feature',
    cards: {
      free: ['1 property (no add-ons)', 'AI website design', 'iCal sync'],
      core: ['5 properties (+$4/property)', '1 collaborator', 'Dynamic pricing rules', 'Promo codes', 'Email sync (OTA order import)'],
      pro: ['5 properties (+$3/property)', '2 collaborators', 'Promo codes', 'Real-time sync, 60+ channels (prevents overbooking)', 'CS integration (order password lookup)', '1 free setup assist / month'],
      enterprise: ['15 properties (+$2/property)', 'Unlimited collaborators', 'Custom dynamic pricing rules', 'Promo codes', '2 free setup assists / month'],
    },
    rows: [
      { label: 'Property count (base + add-on)', values: ['1 (no add-ons)', '5 (+$4/property)', '5 (+$3/property)', '15 (+$2/property)'] },
      { label: 'Collaborators', values: ['0', '1', '2', 'Unlimited'] },
      { label: 'Dynamic pricing rules', values: ['—', '✓', '✓', '✓ + custom rules'] },
      { label: 'Promo codes', values: ['—', '✓', '✓', '✓'] },
      { label: 'AI website design', values: ['✓', '✓', '✓', '✓'] },
      { label: 'iCal sync (backup, not real-time)', values: ['✓', '✓', '✓', '✓'] },
      { label: 'Email sync (OTA order import, backup)', values: ['—', '✓', '✓', '✓'] },
      { label: 'Real-time sync, 60+ channels (prevents overbooking)', values: ['—', '—', '✓ (all properties)', '✓ (all properties)'] },
      { label: 'CS integration (order password lookup)', values: ['—', '—', '✓', '✓'] },
      { label: 'Setup assist (overage $20/session)', values: ['0/month', '0/month', '1/month', '2/month'] },
    ],
  },
  vi: {
    currentBadge: (plan, limit) => `Hiện tại: ${plan} (giới hạn phòng ${limit})`,
    cycleYearly: 'Trả năm (giảm ~10%)',
    cycleMonthly: 'Trả tháng',
    perMonthUnit: 'USD/tháng',
    yearlyTotal: amt => `$${amt}/năm`,
    savePct: pct => `Tiết kiệm ${pct}%`,
    current: 'Đang dùng',
    recommended: 'Đề xuất',
    upgrade: 'Nâng cấp',
    currentPlanBtn: 'Gói hiện tại',
    checkoutFailed: 'Tạo đơn hàng thất bại',
    networkError: 'Lỗi mạng, vui lòng thử lại sau',
    footnote1: 'Gói có hiệu lực ngay sau khi thanh toán, không tự động gia hạn — cần mua lại trước khi hết hạn. Liên hệ hỗ trợ để mua thêm phòng.',
    legalNote: 'Số phòng vượt hạn mức cơ bản sẽ tính theo mua thêm. Lưu ý quy định pháp luật về số phòng nhà nghỉ — vượt quá cần tự xác nhận theo giấy phép.',
    assistScopeNote: 'Phạm vi "Hỗ trợ cài đặt": hỗ trợ kết nối các kênh OTA và cấu hình các tính năng trong hệ thống. Không bao gồm việc đăng ký tài khoản mới trên các nền tảng OTA — đây là dịch vụ tính phí riêng.',
    featureCol: 'Tính năng',
    cards: {
      free: ['1 phòng (không mua thêm)', 'Thiết kế website AI', 'Đồng bộ iCal'],
      core: ['5 phòng (+$4/phòng)', '1 cộng tác viên', 'Quy tắc định giá động', 'Mã khuyến mãi', 'Đồng bộ Email (nhập đơn từ OTA)'],
      pro: ['5 phòng (+$3/phòng)', '2 cộng tác viên', 'Mã khuyến mãi', 'Đồng bộ tức thời 60+ kênh (chống overbooking)', 'Tích hợp CS (tra mật khẩu đơn)', '1 lần hỗ trợ cài đặt miễn phí/tháng'],
      enterprise: ['15 phòng (+$2/phòng)', 'Cộng tác viên không giới hạn', 'Quy tắc định giá tùy chỉnh', 'Mã khuyến mãi', '2 lần hỗ trợ cài đặt miễn phí/tháng'],
    },
    rows: [
      { label: 'Số phòng (cơ bản + mua thêm)', values: ['1 (không mua thêm)', '5 (+$4/phòng)', '5 (+$3/phòng)', '15 (+$2/phòng)'] },
      { label: 'Cộng tác viên', values: ['0', '1', '2', 'Không giới hạn'] },
      { label: 'Quy tắc định giá động', values: ['—', '✓', '✓', '✓ + tùy chỉnh'] },
      { label: 'Mã khuyến mãi', values: ['—', '✓', '✓', '✓'] },
      { label: 'Thiết kế website AI', values: ['✓', '✓', '✓', '✓'] },
      { label: 'Đồng bộ iCal (dự phòng, không tức thời)', values: ['✓', '✓', '✓', '✓'] },
      { label: 'Đồng bộ Email (nhập đơn OTA, dự phòng)', values: ['—', '✓', '✓', '✓'] },
      { label: 'Đồng bộ tức thời 60+ kênh (chống overbooking)', values: ['—', '—', '✓ (tất cả phòng)', '✓ (tất cả phòng)'] },
      { label: 'Tích hợp CS (tra mật khẩu đơn)', values: ['—', '—', '✓', '✓'] },
      { label: 'Hỗ trợ cài đặt (vượt hạn mức $20/lần)', values: ['0 lần/tháng', '0 lần/tháng', '1 lần/tháng', '2 lần/tháng'] },
    ],
  },
}

export default function BookingPlanPage() {
  const t = useTranslations('Booking')
  const locale = useLocale() as Locale
  const copy = COPY[locale] ?? COPY['zh-TW']
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
      if (!res.ok) { alert(data.error ?? copy.checkoutFailed); return }

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
      alert(copy.networkError)
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
            {copy.currentBadge(PLAN_NAME[plan], propertyLimit ?? 1)}
          </span>
          <div className="flex gap-1 text-xs">
            <button onClick={() => setCycle('yearly')}
              className={`px-2.5 py-1 rounded-lg ${cycle === 'yearly' ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-500'}`}>
              {copy.cycleYearly}
            </button>
            <button onClick={() => setCycle('monthly')}
              className={`px-2.5 py-1 rounded-lg ${cycle === 'monthly' ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-500'}`}>
              {copy.cycleMonthly}
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {PLAN_META.map(c => {
          const isCurrent = plan === c.id
          const isFree = c.id === 'free'
          const packageId = cycle === 'monthly' ? c.monthlyId : c.yearlyId
          const yearlyMonthlyEquiv = c.yearlyUsd / 12
          const savingsPct = c.monthlyUsd > 0 ? Math.round((1 - c.yearlyUsd / (c.monthlyUsd * 12)) * 100) : 0

          return (
            <div key={c.id}
              className={`rounded-xl border p-4 space-y-3 ${c.highlight ? 'border-indigo-500 bg-indigo-50/40 ring-1 ring-indigo-500' : 'bg-white'} ${isCurrent ? 'ring-1 ring-green-500 border-green-500' : ''}`}>
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold text-gray-900">{PLAN_NAME[c.id]}</span>
                {isCurrent ? (
                  <span className="flex items-center gap-1 text-[10px] text-green-600 font-medium"><Check className="h-3 w-3" />{copy.current}</span>
                ) : c.highlight && (
                  <span className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-indigo-600 text-white font-medium">
                    <Sparkles className="h-3 w-3" />{copy.recommended}
                  </span>
                )}
              </div>

              {isFree ? (
                <div className="text-2xl font-bold text-gray-900">$0</div>
              ) : cycle === 'monthly' ? (
                <div className="text-2xl font-bold text-gray-900">
                  ${c.monthlyUsd} <span className="text-xs font-normal text-gray-500">{copy.perMonthUnit}</span>
                </div>
              ) : (
                <div className="space-y-0.5">
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-xs line-through text-gray-400">${c.monthlyUsd}</span>
                    <span className="text-2xl font-bold text-gray-900">${yearlyMonthlyEquiv.toFixed(2)}</span>
                    <span className="text-xs font-normal text-gray-500">{copy.perMonthUnit}</span>
                    {savingsPct > 0 && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-green-100 text-green-700 font-medium">{copy.savePct(savingsPct)}</span>}
                  </div>
                  <div className="text-[10px] text-gray-400">{copy.yearlyTotal(c.yearlyUsd)}</div>
                </div>
              )}

              <ul className="text-xs text-gray-600 space-y-1.5">
                {copy.cards[c.id].map(f => (
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
                  {isCurrent ? copy.currentPlanBtn : copy.upgrade}
                </button>
              )}
            </div>
          )
        })}
      </div>

      <p className="text-[11px] text-gray-400">{copy.footnote1}</p>

      <div className="overflow-x-auto rounded-xl border bg-white">
        <table className="w-full text-xs border-collapse min-w-[640px]">
          <thead>
            <tr className="bg-gray-50 border-b">
              <th className="text-left font-medium py-2.5 px-3 text-gray-500">{copy.featureCol}</th>
              {(['free', 'core', 'pro', 'enterprise'] as BookingPlan[]).map(id => (
                <th key={id} className="text-center font-medium py-2.5 px-3 text-gray-500">{PLAN_NAME[id]}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {copy.rows.map(row => (
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

      <p className="text-[11px] text-gray-400">{copy.assistScopeNote}</p>
      <p className="text-[11px] text-gray-400">{copy.legalNote}</p>
    </div>
  )
}
