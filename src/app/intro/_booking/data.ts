// 訂房介紹頁（/intro、/intro/features、/intro/pricing 的 booking 子網域版本）共用的方案資料。
// 價格一律讀 lib/ecpay/booking-plans.ts（結帳權威金額），功能一律讀 lib/booking/entitlements.ts（權限權威），
// 不在介紹頁另外寫死，避免跟站內升級頁、實際權限對不上。
import { BOOKING_PLAN_FEATURES, type BookingPlan, type BookingPlanFeatures } from '@/lib/booking/entitlements'
import { BOOKING_PLAN_PACKAGES } from '@/lib/ecpay/booking-plans'

export const BK_PLANS: BookingPlan[] = ['free', 'core', 'pro', 'enterprise']
// 方案名稱固定用英文（enterprise 對外名稱為 MAX，與 /booking/plan 一致）
export const PLAN_NAME: Record<BookingPlan, string> = { free: 'FREE', core: 'CORE', pro: 'PRO', enterprise: 'MAX' }

export function planPrice(plan: BookingPlan, cycle: 'monthly' | 'yearly'): number {
  if (plan === 'free') return 0
  return BOOKING_PLAN_PACKAGES.find(p => p.plan === plan && p.cycle === cycle)?.usdPrice ?? 0
}

// 年繳相對月繳×12 省下的百分比
export function yearlySavePct(plan: BookingPlan): number {
  const m = planPrice(plan, 'monthly')
  if (!m) return 0
  return Math.round((1 - planPrice(plan, 'yearly') / (m * 12)) * 100)
}

export const PLAN_FIT: Record<BookingPlan, string> = {
  free: '一間房，先做官網、接 iCal 試試看',
  core: '自己經營幾間房，要動態定價和優惠碼',
  pro: '上架多個平台，需要即時同步防超賣',
  enterprise: '房源多、團隊大，要客製定價規則',
}

// 各方案卡片重點（對應站內 /booking/plan 的 cards 文案）
export const PLAN_HIGHLIGHTS: Record<BookingPlan, string[]> = {
  free: ['1 房源（不可加購）', '官網 AI 設計', 'iCal 同步'],
  core: ['5 房源（+$4/房源）', '1 位協作者', '動態定價規則', '優惠碼', 'Email 同步（OTA 信件轉單）'],
  pro: ['5 房源（+$3/房源）', '2 位協作者', '即時同步 60+ 平台（秒級防超賣）', '與 IMT 智能客服串接', '每月 1 次免費協助設定'],
  enterprise: ['15 房源（+$2/房源）', '協作者不限', '動態定價客製規則', '優惠碼', '每月 2 次免費協助設定'],
}

const yes = (b: boolean) => (b ? '✓' : '—')
const col = (f: (x: BookingPlanFeatures, p: BookingPlan) => string) =>
  BK_PLANS.map(p => f(BOOKING_PLAN_FEATURES[p], p)) as [string, string, string, string]

export const COMPARISON_GROUPS: Array<{ title: string; rows: Array<{ label: string; values: [string, string, string, string]; market?: string }> }> = [
  {
    title: '規模',
    rows: [
      {
        label: '房源數（基本＋加購）',
        values: col(f => (f.extraPropertyPriceUsd ? `${f.propertyBaseLimit}（+$${f.extraPropertyPriceUsd}/房源）` : `${f.propertyBaseLimit}（不可加購）`)),
      },
      { label: '協作者', values: col(f => (f.collaboratorLimit === Infinity ? '不限' : f.collaboratorLimit === 0 ? '不可邀請' : `${f.collaboratorLimit} 位`)) },
    ],
  },
  {
    title: '官網與訂房',
    rows: [
      { label: '官網 AI 設計', values: ['✓', '✓', '✓', '✓'], market: '通常另外加購' },
      { label: '線上訂房（官網直訂）', values: ['✓', '✓', '✓', '✓'] },
      { label: '訂單、空房表、日曆、每日入住', values: ['✓', '✓', '✓', '✓'] },
      { label: '通知信、評價、數據報表', values: ['✓', '✓', '✓', '✓'] },
    ],
  },
  {
    title: '定價與優惠',
    rows: [
      { label: '動態定價規則', values: col((f, p) => (f.dynamicPricing ? (p === 'enterprise' ? '✓＋客製規則' : '✓') : '—')), market: '通常不支援或另外加購' },
      { label: '優惠碼', values: col(f => yes(f.promoCodes)), market: '通常不支援' },
    ],
  },
  {
    title: '通路同步',
    rows: [
      { label: 'iCal 同步（備援，非即時）', values: ['✓', '✓', '✓', '✓'] },
      { label: 'Email 同步（OTA 信件轉單，備援）', values: col(f => yes(f.emailSync)) },
      { label: '即時同步 60+ 平台（秒級防超賣）', values: col(f => (f.realtimeSync ? '✓（全房源皆含）' : '—')) },
      { label: '與 IMT 智能客服串接（AI 查訂單）', values: col(f => yes(f.csIntegration)) },
    ],
  },
  {
    title: '服務',
    rows: [
      {
        label: '人工協助設定',
        values: col(f => (f.assistedSetup.freePerMonth > 0 ? `每月 ${f.assistedSetup.freePerMonth} 次免費（超額 $${f.assistedSetup.priceUsd}/次）` : `$${f.assistedSetup.priceUsd}/次`)),
      },
    ],
  },
]
