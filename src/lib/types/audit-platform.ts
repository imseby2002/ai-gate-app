/**
 * AI Audit Intelligence Platform (企業稽核智慧平台) 領域模型與型別定義
 */

// 1. 規則狀態分級 (4 種等級)
export type AuditRuleStatus = 'hypothesis' | 'suggested' | 'approved' | 'hard_rule'

// 規則分類
export type AuditRuleCategory =
  | 'material'      // 原物料耗用與配方調校
  | 'hygiene'       // 環境衛生與動線
  | 'service'       // 服務行為與客觀觀察
  | 'quality'       // 食品外觀與感官品質
  | 'safety'        // 原料安全與作廢管控
  | 'stock'         // 缺料與庫存安全天數
  | 'marketing'     // 門市行銷與 Zalo 執行率

// 規則主體
export interface AuditRule {
  id: string
  rule_code: string              // 例: RULE-00038, RULE-00042
  title: string
  status: AuditRuleStatus        // hypothesis | suggested | approved | hard_rule
  category: AuditRuleCategory
  target_product: string         // 適用商品，如「珍珠奶茶 500ml」、「全品項」
  condition_desc: string         // 適用條件，如「2 toppings (珍珠 + 椰果)」
  adjustment_type: string        // tea_adjustment, creamer_adjustment, displacement
  adjustment_value: string       // 人類可讀，如「+18ml 基底茶」
  numerical_delta: number        // 數值調校量，如 18 或 -10
  unit: string                   // ml, g, 份
  version: string                // V1, V2, V3
  effective_from: string         // YYYY-MM-DD
  effective_to?: string | null
  approved_by?: string | null    // 審核主管
  hypothesis_reason: string      // 推理脈絡或成因
  confidence: number             // AI 信心度 0-100%
  store?: string                 // 特定門市或通用
  created_at: string
  updated_at: string
}

// 規則版本歷史歷程 (不可覆蓋，永久留存審核軌跡)
export interface AuditRuleVersion {
  id: string
  rule_id: string
  rule_code: string
  version: string
  adjustment_value: string
  numerical_delta: number
  effective_from: string
  effective_to?: string | null
  approved_by: string
  change_note: string
  created_at: string
}

// 2. 資料層 (Data Layer)
export interface IPOSSalesRecord {
  id?: string
  store: string
  date: string
  product_code: string
  product_name: string
  size: '500ml' | '700ml' | 'L' | 'M' | string
  qty: number
  toppings_count: number
  toppings_detail: { name: string; qty: number }[]
  revenue: number
}

export interface IVTMovementRecord {
  id?: string
  store: string
  date: string
  material_code: string
  material_name: string
  unit: string
  open_qty: number       // 期初
  in_total: number       // 叫貨/進貨
  out_pos: number        // 規定用量
  usage_month: number    // 當月實耗
  close_qty: number      // 期末盤點
  waste_qty?: number     // 報廢量
  is_scrapped?: boolean  // 是否標記為作廢原料
}

export interface IngredientPricingRecord {
  id?: string
  ingredient_code: string
  ingredient_name: string
  supplier: string
  central_kitchen_price: number  // 中央廚房進貨價
  store_transfer_price: number   // 門市調撥出貨價
  effective_date: string         // 價格生效日期
  unit: string
  currency: 'VND' | 'TWD' | string
}

export interface RDRecipeVersioned {
  id?: string
  product_code: string
  product_name: string
  version: string                // V1, V2
  size: string
  effective_from: string
  effective_to?: string | null
  base_tea_code: string
  base_tea_amount: number        // ml
  milk_code?: string
  milk_amount?: number           // ml
  creamer_code?: string
  creamer_amount?: number        // g
  sugar_amount?: number          // g or ml
  ice_level?: string
  cup_code: string
  lid_code: string
  straw_code: string
  standard_toppings: { topping_code: string; qty: number }[]
  yield_ml: number
  production_method: string
}

// 3. Product Composition Model (商品組合耗用排擠模型)
export interface ProductCompositionRule {
  product_code: string
  topping_count: number          // 0, 1, 2, 3
  tea_delta_ml: number           // 基底茶微調 (加 2 topping 平均增加 18ml 等)
  creamer_delta_g: number
  liquid_displacement_ml: number // 加料排擠液體量
  applied_rule_code?: string
}

// 4. 原料耗用推算引擎計算結果 (Consumption Analysis)
export interface MaterialConsumptionRow {
  material_code: string
  material_name: string
  unit: string
  raw_theoretical_qty: number       // 純配方標準用量
  composition_adjusted_qty: number  // 經由 Product Composition Model 與規則引擎修正後的理論值
  actual_usage_qty: number          // IVT 實耗
  diff_qty: number                  // 實耗 - 修正理論值
  diff_pct: number | null           // 誤差率 %
  unit_price: number                // 出納門市進貨價
  money_loss: number                // 金額差異
  anomaly_level: 'normal' | 'low_risk' | 'high_risk' | 'critical'
  possible_causes: string[]
  applied_rules: string[]
  trend_vs_history: string          // 同店歷史同期比較
  store_vs_peers: string            // 同商圈同類門市比較
}

// 5. Audit Copilot (稽核副駕駛)
export type CopilotMode = 'discuss' | 'guide' | 'suggest' | 'answer'

export interface AuditCopilotMessage {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  mode: CopilotMode
  timestamp: string
  suggestion_card?: AuditSuggestionCard
}

export interface AuditSuggestionCard {
  issue_title: string
  possible_causes: {
    title: string
    probability: number
    description: string
  }[]
  ai_confidence: number
  evidence: {
    source: 'IPOS' | 'IVT' | 'Recipe' | 'History' | 'Pricing' | string
    detail: string
  }[]
  actionable_proposals: string[]
  candidate_rule?: {
    code: string
    target_product: string
    condition: string
    adjustment_type: string
    adjustment_value: string
    numerical_delta: number
    unit: string
    proposed_status: AuditRuleStatus
  }
}

// 6. Audit Knowledge Log (自動日誌與稽核知識圖譜)
export interface AuditKnowledgeLog {
  id: string
  date: string
  auditor_name: string
  issue_title: string
  store: string
  chat_count: number
  findings: string
  solution_adopted: string
  related_rule_code?: string
  status: 'pending_approval' | 'approved' | 'rejected' | 'upgraded_to_hard_rule'
  created_at: string
}

// 7. 六大稽核模組總覽資料結構
export interface AuditPlatformOverview {
  material_engine: {
    status: 'healthy' | 'warning' | 'alert'
    total_theor_loss: number
    abnormal_items_count: number
    top_abnormal_materials: string[]
  }
  environment_engine: {
    status: 'pass' | 'attention' | 'fail'
    hygiene_score: number
    critical_risk_items: { item: string; distance_risk: boolean; guideline_violated: string }[]
  }
  service_engine: {
    status: 'pass' | 'attention'
    greeting_within_5s_rate: number
    customer_observation_count: number
    alerts: string[]
  }
  food_quality_engine: {
    status: 'normal' | 'sample_needed'
    boba_texture_abnormal: boolean
    boba_color_status: string
    pending_inspector_confirm: number
  }
  material_safety_engine: {
    status: 'secure' | 'danger_alert'
    scrapped_materials_in_inventory: number
    illegal_usage_detected: boolean
    alerts: string[]
  }
  stock_risk_engine: {
    status: 'green' | 'yellow' | 'orange' | 'red'
    shortage_items: {
      material_name: string
      days_remaining: number
      urgency_level: 'normal' | 'soon' | 'high_risk' | 'depleted'
    }[]
  }
  marketing_compliance_engine: {
    status: 'good' | 'lagging'
    zalo_group_new_members: number
    target_members: number
    completion_rate: number
  }
}
