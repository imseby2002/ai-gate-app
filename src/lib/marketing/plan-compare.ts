// 行銷方案卡片與功能比較表：站內升級頁（MarketingPlanUpgrade）與公開介紹頁（/intro/pricing）共用。
// 價格需與 lib/ecpay/marketing-plans.ts 一致；功能需與 lib/marketing/entitlements.ts 一致。
import type { MarketingPlan } from './entitlements'

export const PLAN_CARDS: Array<{
  plan: Exclude<MarketingPlan, 'free'>
  name: string
  monthlyId: string
  yearlyId: string
  monthlyUsd: number
  yearlyUsd: number
  features: string[]
}> = [
  {
    plan: 'pro', name: 'CORE', monthlyId: 'pro_monthly', yearlyId: 'pro_yearly', monthlyUsd: 29, yearlyUsd: 278,
    features: ['10 個行銷案', '1 位協作人員', '用量扣點 ×1.8（FREE 為 ×2）', '所有生成功能依用量扣點'],
  },
  {
    plan: 'team', name: 'PRO', monthlyId: 'team_monthly', yearlyId: 'team_yearly', monthlyUsd: 49, yearlyUsd: 470,
    features: ['包含 CORE 全部功能', '行銷案、協作人員無上限', '用量扣點 ×1.6', '行銷流水線（全自動）', '社群矩陣＋附贈 1 個官方發文 IP'],
  },
  {
    plan: 'enterprise', name: 'MAX', monthlyId: 'enterprise_monthly', yearlyId: 'enterprise_yearly', monthlyUsd: 79, yearlyUsd: 758,
    features: ['包含 PRO 全部功能', '用量扣點 ×1.4', '企業客製功能'],
  },
]

// 功能比較表：每一列對應一個功能，四欄分別是免費／CORE／PRO／MAX的值
export const COMPARISON_ROWS: Array<{ label: string; values: [string, string, string, string] }> = [
  { label: '行銷案數', values: ['1 個', '10 個', '無限', '無限'] },
  { label: '協作人員', values: ['不可邀請', '1 位', '無限', '無限'] },
  { label: '用量扣點倍率（實際成本 ×）', values: ['×2', '×1.8', '×1.6', '×1.4'] },
  { label: '資料蒐集／分析／文案（依用量扣點）', values: ['✓', '✓', '✓', '✓'] },
  { label: '圖片產出（依用量扣點）', values: ['✓', '✓', '✓', '✓'] },
  { label: '一鍵主動推文（11 個社群平台，每則 0.01 點）', values: ['✓', '✓', '✓', '✓'] },
  { label: '影片產出（依用量扣點）', values: ['✓', '✓', '✓', '✓'] },
  { label: 'AI 電訪＋Email（依用量扣點）', values: ['✓', '✓', '✓', '✓'] },
  { label: '主播行銷 HeyGen（依用量扣點）', values: ['✓', '✓', '✓', '✓'] },
  { label: 'AI 產品行銷設計師（依用量扣點）', values: ['✓', '✓', '✓', '✓'] },
  { label: 'AI 視覺工坊（依用量扣點）', values: ['✓', '✓', '✓', '✓'] },
  { label: 'GEO 內容寫手（依用量扣點）', values: ['✓', '✓', '✓', '✓'] },
  { label: '潛在客戶行銷（依用量扣點）', values: ['✓', '✓', '✓', '✓'] },
  { label: '專家技能（點數扣款）', values: ['✓', '✓', '✓', '✓'] },
  { label: '自製專家（依用量扣點）', values: ['✓', '✓', '✓', '✓'] },
  { label: '行銷流水線（全自動）', values: ['—', '—', '✓', '✓'] },
  { label: '社群矩陣自動發文＋養號', values: ['—', '—', '✓', '✓'] },
  { label: '官方發文 IP（亦可自備）', values: ['—', '—', '附贈 1 個＋點數加購', '附贈 1 個＋點數加購'] },
]
