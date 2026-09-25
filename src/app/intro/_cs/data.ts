// 客服介紹頁（/intro、/intro/features、/intro/pricing 的 cs 子網域版本）共用的方案資料。
// 價格一律讀 lib/ecpay/cs-plans.ts（結帳權威金額），功能一律讀 lib/cs/entitlements.ts（權限權威），
// 不在介紹頁另外寫死，避免跟站內升級頁、實際權限對不上。
import { CS_PLAN_FEATURES, CS_FEATURE_REQUEST_PRICING, type CsPlan, type CsPlanFeatures } from '@/lib/cs/entitlements'
import { CS_PLAN_PACKAGES } from '@/lib/ecpay/cs-plans'

export const CS_PLANS: CsPlan[] = ['free', 'core', 'pro', 'max']
export const PLAN_NAME: Record<CsPlan, string> = { free: 'FREE', core: 'CORE', pro: 'PRO', max: 'MAX' }

export function planPrice(plan: CsPlan, cycle: 'monthly' | 'yearly'): number {
  if (plan === 'free') return 0
  return CS_PLAN_PACKAGES.find(p => p.plan === plan && p.cycle === cycle)?.usdPrice ?? 0
}

// 年繳相對月繳×12 省下的百分比
export function yearlySavePct(plan: CsPlan): number {
  const m = planPrice(plan, 'monthly')
  if (!m) return 0
  return Math.round((1 - planPrice(plan, 'yearly') / (m * 12)) * 100)
}

export const PLAN_FIT: Record<CsPlan, string> = {
  free: '先把 AI 客服接上 LINE，試試回覆品質',
  core: '自己顧店，要工單、收件匣、看圖回覆',
  pro: '有夥伴一起顧客服，需要即時查天氣景點',
  max: '多平台、多分店，要 AI 精準報價',
}

// 各方案卡片的重點（對應站內 /cs/plan 升級頁的 featXxx 文案）
export const PLAN_HIGHLIGHTS: Record<CsPlan, string[]> = {
  free: ['3 個平台串接', '不限訊息則數', '知識庫＋行業模板', '基本 AI 設定'],
  core: ['統一收件匣＋工單系統', '複雜客服／圖片辨識', '高風險對話升級 Claude', 'WhatsApp 個人版', 'Google Sheets 資料來源', '1 位協作人員'],
  pro: ['包含 CORE 全部功能', '即時網路搜尋', '最多 5 位協作人員', '每月 1 次免費協助設定'],
  max: ['包含 PRO 全部功能', '不限平台數', '報價計算機', '協作人員不限', '每月 2 次免費協助設定'],
}

const yes = (b: boolean) => (b ? '✓' : '—')
const count = (n: number, unit: string, zero: string) => (n === Infinity ? '不限' : n === 0 ? zero : `${n} ${unit}`)
const col = (f: (x: CsPlanFeatures, p: CsPlan) => string) =>
  CS_PLANS.map(p => f(CS_PLAN_FEATURES[p], p)) as [string, string, string, string]

export const COMPARISON_GROUPS: Array<{ title: string; rows: Array<{ label: string; values: [string, string, string, string]; market?: string }> }> = [
  {
    title: '接入與用量',
    rows: [
      { label: '客服訊息則數', values: ['不限', '不限', '不限', '不限'], market: '每月 50–100 則上限，超過加價' },
      { label: '平台串接數', values: col(f => count(f.platformLimit, '個', '—')), market: '依方案 1–2 個' },
      { label: 'WhatsApp 個人版', values: col(f => yes(f.whatsappPersonal)), market: '多數不支援' },
      { label: '協作人員', values: col(f => count(f.collaboratorLimit, '位', '不可邀請')), market: '按席位另計' },
    ],
  },
  {
    title: 'AI 回覆',
    rows: [
      { label: '知識庫', values: ['✓', '✓', '✓', '✓'], market: '常需加購' },
      { label: 'AI 設定', values: col(f => (f.aiSettingsScope === 'full' ? '完整' : '基本')), market: '基礎版本' },
      { label: '高風險對話升級 Claude', values: col(f => yes(f.claudeEscalation !== 'off')) },
      { label: '複雜客服／圖片辨識', values: col(f => yes(f.advancedSupport)), market: '多數不支援' },
      { label: '自動學習', values: col(f => yes(f.autoLearning)) },
      { label: '即時網路搜尋', values: col(f => yes(f.webSearch)), market: '多數不支援' },
    ],
  },
  {
    title: '營運工具',
    rows: [
      { label: '統一收件匣', values: col(f => yes(f.inbox)), market: '常需加購' },
      { label: '工單系統', values: col(f => yes(f.tickets)), market: '常需加購' },
      { label: '資料來源（Google Sheets）', values: col(f => yes(f.dataSources)) },
      { label: '報價計算機', values: col(f => yes(f.pricingCalculator)) },
    ],
  },
  {
    title: '服務',
    rows: [
      {
        label: '協助設定',
        values: col((f, p) => (f.assistedSetup.freePerMonth > 0
          ? `每月 ${f.assistedSetup.freePerMonth} 次免費`
          : `$${f.assistedSetup.priceUsd}/次${p === 'core' ? '（新升級首次免費）' : ''}`)),
        market: '通常另計顧問費',
      },
      {
        label: '基礎客製功能',
        values: col((_, p) => `$${CS_FEATURE_REQUEST_PRICING.basicPriceUsdByPlan[p]}/次`),
      },
    ],
  },
]

export { CS_FEATURE_REQUEST_PRICING }
