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
    features: ['10 個行銷案', '圖片產出＋自動上傳平台', 'AI 產品行銷設計師（策略＋文案）', 'GEO 產文無限', 'Email 行銷'],
  },
  {
    plan: 'team', name: 'PRO', monthlyId: 'team_monthly', yearlyId: 'team_yearly', monthlyUsd: 49, yearlyUsd: 470,
    features: ['包含 CORE 全部功能', '行銷案無上限', '影片產出＋AI 電訪', 'AI 視覺工坊', '行銷流水線', '可建立自製專家'],
  },
  {
    plan: 'enterprise', name: 'MAX', monthlyId: 'enterprise_monthly', yearlyId: 'enterprise_yearly', monthlyUsd: 79, yearlyUsd: 758,
    features: ['包含 PRO 全部功能', '主播行銷（HeyGen）', 'AI 視覺工坊全節點', '企業客製功能'],
  },
]

// 功能比較表：每一列對應一個功能，四欄分別是免費／CORE／PRO／MAX的值
export const COMPARISON_ROWS: Array<{ label: string; values: [string, string, string, string] }> = [
  { label: '行銷案數', values: ['1 個', '10 個', '無限', '無限'] },
  { label: '協作人員', values: ['不可邀請', '1 位', '無限', '無限'] },
  { label: '資料蒐集／分析／文案', values: ['基本', '✓', '✓', '✓'] },
  { label: '圖片產出（點數扣款）', values: ['—', '✓', '✓', '✓'] },
  { label: '自動上傳平台', values: ['—', '✓', '✓', '✓'] },
  { label: '影片產出（點數扣款）', values: ['—', '—', '✓', '✓'] },
  { label: 'AI 電訪＋Email（點數扣款）', values: ['—', 'Email', '✓', '✓'] },
  { label: '主播行銷 HeyGen（點數扣款）', values: ['—', '—', '—', '✓'] },
  { label: 'AI 產品行銷設計師', values: ['—', '策略＋文案', '全開', '全開'] },
  { label: 'AI 視覺工坊', values: ['—', '—', '基礎節點', '全節點'] },
  { label: 'GEO 內容寫手', values: ['每月 1 篇', '無限', '無限', '無限'] },
  { label: '行銷流水線', values: ['—', '—', '✓', '✓'] },
  { label: '潛在客戶行銷', values: ['蒐集＋篩選', '+Email', '+電話撥打', '全開'] },
  { label: '專家技能（點數扣款）', values: ['✓', '✓', '✓', '✓'] },
  { label: '自製專家', values: ['僅使用', '僅使用', '可建立', '可建立'] },
]
