import type {
  AuditRule,
  AuditRuleVersion,
  IPOSSalesRecord,
  IVTMovementRecord,
  IngredientPricingRecord,
  RDRecipeVersioned,
  MaterialConsumptionRow,
  AuditKnowledgeLog,
  AuditPlatformOverview,
} from '@/lib/types/audit-platform'

// 1. 預設四等級規則庫 (Rule Library)
export const INITIAL_AUDIT_RULES: AuditRule[] = [
  {
    id: 'rule-00038',
    rule_code: 'RULE-00038',
    title: '珍珠奶茶 500ml 雙料 (2 toppings) 基底茶消耗補償',
    status: 'hard_rule',
    category: 'material',
    target_product: '珍珠奶茶 500ml',
    condition_desc: '加 2 種加料 (如珍珠+椰果)',
    adjustment_type: 'tea_adjustment',
    adjustment_value: '+18ml 紅茶基底',
    numerical_delta: 18,
    unit: 'ml',
    version: 'V2',
    effective_from: '2026-05-01',
    effective_to: null,
    approved_by: '稽核總監 陳浩然 (Audit Director)',
    hypothesis_reason: '雙料入杯後排擠體積，但調茶員習慣補滿杯緣線，實測平均基底茶耗用增加 18ml。',
    confidence: 98,
    created_at: '2026-05-01T08:00:00Z',
    updated_at: '2026-08-26T10:00:00Z',
  },
  {
    id: 'rule-00042',
    rule_code: 'RULE-00042',
    title: '珍珠奶茶 700ml 雙料基底與奶精消耗修正',
    status: 'approved',
    category: 'material',
    target_product: '珍珠奶茶 700ml',
    condition_desc: '加 2 種加料 (2 toppings)',
    adjustment_type: 'tea_adjustment',
    adjustment_value: '+20ml 紅茶基底',
    numerical_delta: 20,
    unit: 'ml',
    version: 'V3',
    effective_from: '2026-08-26',
    effective_to: null,
    approved_by: '稽核經理 林志成 (Audit Manager)',
    hypothesis_reason: '大杯 700ml 雙料在雪克搖勻後泡沫消退，出杯時員工多補 20ml 茶湯防止不滿杯。',
    confidence: 94,
    created_at: '2026-06-01T09:00:00Z',
    updated_at: '2026-08-26T14:30:00Z',
  },
  {
    id: 'rule-00015',
    rule_code: 'RULE-00015',
    title: '鮮奶茶系列 微冰/去冰 鮮奶排擠與補量標準',
    status: 'hard_rule',
    category: 'material',
    target_product: '烏龍拿鐵 / 紅茶拿鐵',
    condition_desc: '微冰或去冰',
    adjustment_type: 'milk_adjustment',
    adjustment_value: '+30ml 鮮奶',
    numerical_delta: 30,
    unit: 'ml',
    version: 'V1',
    effective_from: '2026-01-01',
    effective_to: null,
    approved_by: '總經理 (GM)',
    hypothesis_reason: '無冰塊填充體積，標準 SOP 規定補 30ml 鮮奶以維持醇厚度與滿杯率。',
    confidence: 100,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
  },
  {
    id: 'rule-00055',
    rule_code: 'RULE-00055',
    title: '芒果烏龍單料加料時之果泥耗損偏高假說',
    status: 'suggested',
    category: 'material',
    target_product: '芒果烏龍 500ml',
    condition_desc: '加椰果或寒天 (1 topping)',
    adjustment_type: 'puree_adjustment',
    adjustment_value: '-5g 芒果果泥 (排擠殘留)',
    numerical_delta: -5,
    unit: 'g',
    version: 'V1',
    effective_from: '2026-09-01',
    effective_to: null,
    approved_by: null,
    hypothesis_reason: 'AI 監測近 3 個月數據發現芒果果泥消耗少 5g，研判為寒天甜度高導致員工輕微少舀。建議稽核現場確認。',
    confidence: 84,
    created_at: '2026-09-01T11:20:00Z',
    updated_at: '2026-09-01T11:20:00Z',
  },
  {
    id: 'rule-00062',
    rule_code: 'RULE-00062',
    title: '烏龍奶蓋 500ml 奶霜厚度操作差異假設 (待驗證)',
    status: 'hypothesis',
    category: 'material',
    target_product: '烏龍奶蓋 500ml',
    condition_desc: '常態銷售',
    adjustment_type: 'creamer_adjustment',
    adjustment_value: '+12g 奶霜原料',
    numerical_delta: 12,
    unit: 'g',
    version: 'V1',
    effective_from: '2026-09-08',
    effective_to: null,
    approved_by: null,
    hypothesis_reason: 'AI 發現 A 店奶精/淡奶油使用量高出 12%，推測為新進員工傾倒奶蓋時超過 2cm 刻度線。不可直接處罰，需督導前往實測。',
    confidence: 76,
    created_at: '2026-09-08T15:10:00Z',
    updated_at: '2026-09-08T15:10:00Z',
  },
  {
    id: 'rule-00071',
    rule_code: 'RULE-00071',
    title: '黑糖珍珠逾 4 小時作廢料嚴禁回煮或出杯',
    status: 'hard_rule',
    category: 'safety',
    target_product: '全品項珍珠飲品',
    condition_desc: '煮製完成超過 240 分鐘',
    adjustment_type: 'safety_scrap',
    adjustment_value: '立即報廢銷毀',
    numerical_delta: 0,
    unit: '項',
    version: 'V1',
    effective_from: '2026-01-01',
    effective_to: null,
    approved_by: '食品安全委員會 (Food Safety Board)',
    hypothesis_reason: '珍珠放置逾 4 小時核心硬化且糖液酸度升高，列為公司最高食安紅線。',
    confidence: 100,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
  }
]

// 2. 規則版本歷程 (Rule Change History - 不可覆蓋)
export const INITIAL_RULE_VERSIONS: AuditRuleVersion[] = [
  {
    id: 'ver-00042-1',
    rule_id: 'rule-00042',
    rule_code: 'RULE-00042',
    version: 'V1',
    adjustment_value: '+15ml 紅茶基底',
    numerical_delta: 15,
    effective_from: '2026-06-01',
    effective_to: '2026-08-25',
    approved_by: '林志成 (Audit Manager)',
    change_note: '初版建立：由 6 月份數據推論加料雙料排擠與出杯滿杯補茶習慣。',
    created_at: '2026-06-01T09:00:00Z',
  },
  {
    id: 'ver-00042-2',
    rule_id: 'rule-00042',
    rule_code: 'RULE-00042',
    version: 'V2',
    adjustment_value: '+18ml 紅茶基底',
    numerical_delta: 18,
    effective_from: '2026-08-26',
    effective_to: '2026-09-30',
    approved_by: '林志成 (Audit Manager)',
    change_note: '稽核人員現場抽查 10 家門市 50 杯樣品，實測平均基底補量為 18ml，主管核准修正。',
    created_at: '2026-08-26T14:30:00Z',
  },
  {
    id: 'ver-00042-3',
    rule_id: 'rule-00042',
    rule_code: 'RULE-00042',
    version: 'V3',
    adjustment_value: '+20ml 紅茶基底',
    numerical_delta: 20,
    effective_from: '2026-10-01',
    effective_to: null,
    approved_by: '陳浩然 (Audit Director)',
    change_note: '配合研發部新版 700ml 倒角杯型出水特性，微調至 20ml 並列為 Approved 準則。',
    created_at: '2026-09-05T10:00:00Z',
  }
]

// 3. R&D 版本控制配方 (Recipe Version Control)
export const INITIAL_RECIPES_VERSIONED: RDRecipeVersioned[] = [
  // 珍珠奶茶 500ml V1 (2026/01/01 ~ 2026/04/30)
  {
    id: 'rcp-boba-500-v1',
    product_code: 'PRD-BOBA-500',
    product_name: '珍珠奶茶 500ml',
    version: 'V1',
    size: '500ml',
    effective_from: '2026-01-01',
    effective_to: '2026-04-30',
    base_tea_code: 'MAT-TEA-BLACK',
    base_tea_amount: 200,
    creamer_code: 'MAT-CREAMER-A',
    creamer_amount: 35,
    sugar_amount: 25,
    cup_code: 'MAT-CUP-500',
    lid_code: 'MAT-LID-90',
    straw_code: 'MAT-STRAW-BIG',
    standard_toppings: [{ topping_code: 'MAT-TOPPING-BOBA', qty: 1 }],
    yield_ml: 500,
    production_method: '雪克杯加入冰塊200g，紅茶200ml，奶精35g，二砂糖25g，快速雪克15下倒入珍珠杯。',
  },
  // 珍珠奶茶 500ml V2 (2026/05/01 ~ 現在)
  {
    id: 'rcp-boba-500-v2',
    product_code: 'PRD-BOBA-500',
    product_name: '珍珠奶茶 500ml',
    version: 'V2',
    size: '500ml',
    effective_from: '2026-05-01',
    effective_to: null,
    base_tea_code: 'MAT-TEA-BLACK',
    base_tea_amount: 220, // 茶感加強
    creamer_code: 'MAT-CREAMER-A',
    creamer_amount: 38,
    sugar_amount: 22,    // 減糖升級
    cup_code: 'MAT-CUP-500',
    lid_code: 'MAT-LID-90',
    straw_code: 'MAT-STRAW-BIG',
    standard_toppings: [{ topping_code: 'MAT-TOPPING-BOBA', qty: 1 }],
    yield_ml: 500,
    production_method: '茶香濃郁升級配方：紅茶220ml，優質奶精38g，蔗糖22g，雪克搖勻。',
  },
  // 珍珠奶茶 700ml V1 & V2
  {
    id: 'rcp-boba-700-v1',
    product_code: 'PRD-BOBA-700',
    product_name: '珍珠奶茶 700ml',
    version: 'V1',
    size: '700ml',
    effective_from: '2026-01-01',
    effective_to: '2026-04-30',
    base_tea_code: 'MAT-TEA-BLACK',
    base_tea_amount: 300,
    creamer_code: 'MAT-CREAMER-A',
    creamer_amount: 50,
    sugar_amount: 35,
    cup_code: 'MAT-CUP-700',
    lid_code: 'MAT-LID-90',
    straw_code: 'MAT-STRAW-BIG',
    standard_toppings: [{ topping_code: 'MAT-TOPPING-BOBA', qty: 1 }],
    yield_ml: 700,
    production_method: '700ml 大杯標準調茶流程。',
  },
  {
    id: 'rcp-boba-700-v2',
    product_code: 'PRD-BOBA-700',
    product_name: '珍珠奶茶 700ml',
    version: 'V2',
    size: '700ml',
    effective_from: '2026-05-01',
    effective_to: null,
    base_tea_code: 'MAT-TEA-BLACK',
    base_tea_amount: 320,
    creamer_code: 'MAT-CREAMER-A',
    creamer_amount: 54,
    sugar_amount: 30,
    cup_code: 'MAT-CUP-700',
    lid_code: 'MAT-LID-90',
    straw_code: 'MAT-STRAW-BIG',
    standard_toppings: [{ topping_code: 'MAT-TOPPING-BOBA', qty: 1 }],
    yield_ml: 700,
    production_method: '700ml 大杯濃茶低糖配方。',
  },
  // 烏龍拿鐵 500ml
  {
    id: 'rcp-oolong-latte-500',
    product_code: 'PRD-OOLONG-LATTE-500',
    product_name: '烏龍拿鐵 500ml',
    version: 'V1',
    size: '500ml',
    effective_from: '2026-01-01',
    effective_to: null,
    base_tea_code: 'MAT-TEA-OOLONG',
    base_tea_amount: 220,
    milk_code: 'MAT-MILK-FRESH',
    milk_amount: 140,
    sugar_amount: 18,
    cup_code: 'MAT-CUP-500',
    lid_code: 'MAT-LID-90',
    straw_code: 'MAT-STRAW-THIN',
    standard_toppings: [],
    yield_ml: 500,
    production_method: '現泡重焙烏龍 220ml 緩慢注入冷藏鮮乳 140ml 分層。',
  },
  // 茉莉綠茶 500ml
  {
    id: 'rcp-green-500',
    product_code: 'PRD-GREEN-500',
    product_name: '茉莉綠茶 500ml',
    version: 'V1',
    size: '500ml',
    effective_from: '2026-01-01',
    effective_to: null,
    base_tea_code: 'MAT-TEA-GREEN',
    base_tea_amount: 350,
    sugar_amount: 20,
    cup_code: 'MAT-CUP-500',
    lid_code: 'MAT-LID-90',
    straw_code: 'MAT-STRAW-THIN',
    standard_toppings: [],
    yield_ml: 500,
    production_method: '75度茉莉綠茶湯 350ml 冰鎮雪克。',
  }
]

// 4. 出納定價庫 (Ingredient Pricing with Effective Dates)
export const INITIAL_INGREDIENT_PRICING: IngredientPricingRecord[] = [
  {
    ingredient_code: 'MAT-TEA-BLACK',
    ingredient_name: '經典阿薩姆紅茶茶湯 (每公升)',
    supplier: '越南中央茶葉加工廠',
    central_kitchen_price: 18000,
    store_transfer_price: 24000,
    effective_date: '2026-01-01',
    unit: 'L',
    currency: 'VND',
  },
  {
    ingredient_code: 'MAT-TEA-OOLONG',
    ingredient_name: '炭焙烏龍茶湯 (每公升)',
    supplier: '高山烏龍烘焙坊',
    central_kitchen_price: 22000,
    store_transfer_price: 28000,
    effective_date: '2026-01-01',
    unit: 'L',
    currency: 'VND',
  },
  {
    ingredient_code: 'MAT-TEA-GREEN',
    ingredient_name: '茉莉綠茶茶湯 (每公升)',
    supplier: '中央綠茶萃取中心',
    central_kitchen_price: 16000,
    store_transfer_price: 21000,
    effective_date: '2026-01-01',
    unit: 'L',
    currency: 'VND',
  },
  {
    ingredient_code: 'MAT-CREAMER-A',
    ingredient_name: '優質高脂奶精粉 (每公斤)',
    supplier: '大洋洲乳品供應商',
    central_kitchen_price: 65000,
    store_transfer_price: 82000,
    effective_date: '2026-01-01',
    unit: 'kg',
    currency: 'VND',
  },
  {
    ingredient_code: 'MAT-MILK-FRESH',
    ingredient_name: '巴氏殺菌鮮奶 (每公升)',
    supplier: '巴地牧場直送',
    central_kitchen_price: 38000,
    store_transfer_price: 45000,
    effective_date: '2026-01-01',
    unit: 'L',
    currency: 'VND',
  },
  {
    ingredient_code: 'MAT-TOPPING-BOBA',
    ingredient_name: '黑糖珍珠粉圓 (每公斤熟粉圓)',
    supplier: '中央廚房熟料加工廠',
    central_kitchen_price: 32000,
    store_transfer_price: 42000,
    effective_date: '2026-01-01',
    unit: 'kg',
    currency: 'VND',
  },
  {
    ingredient_code: 'MAT-TOPPING-JELLY',
    ingredient_name: '清脆椰果條 (每公斤)',
    supplier: '東南亞熱帶果品',
    central_kitchen_price: 28000,
    store_transfer_price: 36000,
    effective_date: '2026-01-01',
    unit: 'kg',
    currency: 'VND',
  },
  {
    ingredient_code: 'MAT-CUP-500',
    ingredient_name: 'Feeling Tea 專用 500ml 冷熱紙杯',
    supplier: '宏業包裝',
    central_kitchen_price: 850,
    store_transfer_price: 1100,
    effective_date: '2026-01-01',
    unit: '個',
    currency: 'VND',
  },
  {
    ingredient_code: 'MAT-CUP-700',
    ingredient_name: 'Feeling Tea 專用 700ml 質感紙杯',
    supplier: '宏業包裝',
    central_kitchen_price: 1100,
    store_transfer_price: 1400,
    effective_date: '2026-01-01',
    unit: '個',
    currency: 'VND',
  }
]

// 5. 範例 IPOS 銷售紀錄 (包含加料結構：珍珠奶茶 100 杯 + 珍珠 80 份 + 椰果 30 份)
export const SAMPLE_IPOS_RECORDS: IPOSSalesRecord[] = [
  {
    store: '胡志明一號旗艦店 (HCM-01)',
    date: '2026-09-08',
    product_code: 'PRD-BOBA-500',
    product_name: '珍珠奶茶 500ml',
    size: '500ml',
    qty: 100, // 總共 100 杯
    toppings_count: 110, // 80 珍珠 + 30 椰果
    toppings_detail: [
      { name: '黑糖珍珠', qty: 80 },
      { name: '清脆椰果', qty: 30 },
    ],
    revenue: 4500000,
  },
  {
    store: '胡志明一號旗艦店 (HCM-01)',
    date: '2026-09-08',
    product_code: 'PRD-BOBA-700',
    product_name: '珍珠奶茶 700ml',
    size: '700ml',
    qty: 60,
    toppings_count: 75,
    toppings_detail: [
      { name: '黑糖珍珠', qty: 55 },
      { name: '清脆椰果', qty: 20 },
    ],
    revenue: 3300000,
  },
  {
    store: '胡志明一號旗艦店 (HCM-01)',
    date: '2026-09-08',
    product_code: 'PRD-OOLONG-LATTE-500',
    product_name: '烏龍拿鐵 500ml',
    size: '500ml',
    qty: 80,
    toppings_count: 15,
    toppings_detail: [
      { name: '清脆椰果', qty: 15 },
    ],
    revenue: 4400000,
  },
  {
    store: '胡志明一號旗艦店 (HCM-01)',
    date: '2026-09-08',
    product_code: 'PRD-GREEN-500',
    product_name: '茉莉綠茶 500ml',
    size: '500ml',
    qty: 120,
    toppings_count: 0,
    toppings_detail: [],
    revenue: 3600000,
  },
]

// 6. 範例 IVT 進銷存與實耗紀錄
export const SAMPLE_IVT_RECORDS: IVTMovementRecord[] = [
  {
    store: '胡志明一號旗艦店 (HCM-01)',
    date: '2026-09-08',
    material_code: 'MAT-TEA-BLACK',
    material_name: '經典阿薩姆紅茶茶湯',
    unit: 'L',
    open_qty: 15.0,
    in_total: 45.0,
    out_pos: 41.2,        // 原始標準配方推算 (未調校前)
    usage_month: 44.8,     // 當日實耗 (升)
    close_qty: 15.2,
  },
  {
    store: '胡志明一號旗艦店 (HCM-01)',
    date: '2026-09-08',
    material_code: 'MAT-CREAMER-A',
    material_name: '優質高脂奶精粉',
    unit: 'kg',
    open_qty: 5.0,
    in_total: 10.0,
    out_pos: 7.04,
    usage_month: 7.35,     // 實耗
    close_qty: 7.65,
  },
  {
    store: '胡志明一號旗艦店 (HCM-01)',
    date: '2026-09-08',
    material_code: 'MAT-MILK-FRESH',
    material_name: '巴氏殺菌鮮奶',
    unit: 'L',
    open_qty: 10.0,
    in_total: 20.0,
    out_pos: 11.2,
    usage_month: 12.1,
    close_qty: 17.9,
  },
  {
    store: '胡志明一號旗艦店 (HCM-01)',
    date: '2026-09-08',
    material_code: 'MAT-TEA-OOLONG',
    material_name: '炭焙烏龍茶湯',
    unit: 'L',
    open_qty: 10.0,
    in_total: 25.0,
    out_pos: 17.6,
    usage_month: 17.8,
    close_qty: 17.2,
  },
  {
    store: '胡志明一號旗艦店 (HCM-01)',
    date: '2026-09-08',
    material_code: 'MAT-TEA-GREEN',
    material_name: '茉莉綠茶茶湯',
    unit: 'L',
    open_qty: 12.0,
    in_total: 40.0,
    out_pos: 42.0,
    usage_month: 42.3,
    close_qty: 9.7,
  },
  {
    store: '胡志明一號旗艦店 (HCM-01)',
    date: '2026-09-08',
    material_code: 'MAT-TOPPING-BOBA',
    material_name: '黑糖珍珠粉圓',
    unit: 'kg',
    open_qty: 4.0,
    in_total: 12.0,
    out_pos: 6.75,
    usage_month: 7.2,
    close_qty: 8.8,
  },
  {
    store: '胡志明一號旗艦店 (HCM-01)',
    date: '2026-09-08',
    material_code: 'MAT-CUP-500',
    material_name: 'Feeling Tea 專用 500ml 冷熱紙杯',
    unit: '個',
    open_qty: 300,
    in_total: 500,
    out_pos: 300,
    usage_month: 303, // 廢杯 3 個
    close_qty: 497,
  }
]

// 7. 稽核日誌種子 (Audit Knowledge Logs)
export const INITIAL_KNOWLEDGE_LOGS: AuditKnowledgeLog[] = [
  {
    id: 'log-20260826-01',
    date: '2026-08-26',
    auditor_name: '林志成 (Audit Manager)',
    issue_title: '珍珠奶茶雙料基底耗用異常研討',
    store: '胡志明一號旗艦店',
    chat_count: 17,
    findings: '調取 IPOS 與 10 家門市數據，證實珍珠奶茶 + 2 toppings 時，調茶員為維持滿杯線平均多注入 18ml 茶湯。',
    solution_adopted: '建立商品組合排擠調校模型，修正理論耗用計算公式，並升級為正式稽核準則。',
    related_rule_code: 'RULE-00042',
    status: 'approved',
    created_at: '2026-08-26T17:00:00Z',
  },
  {
    id: 'log-20260901-02',
    date: '2026-09-01',
    auditor_name: '陳浩然 (Audit Director)',
    issue_title: '鮮奶茶微冰排擠補奶規範確認',
    store: '全門市',
    chat_count: 8,
    findings: '微冰/去冰訂單比例達 62%，原配方未計入補奶 30ml 導致每店平均溢耗 12 瓶鮮奶。',
    solution_adopted: '將 SOP 補奶標準納入 Hard Rule (RULE-00015)，修正出納與稽核耗用基線。',
    related_rule_code: 'RULE-00015',
    status: 'upgraded_to_hard_rule',
    created_at: '2026-09-01T16:30:00Z',
  }
]

// 8. 平台總覽狀態
export const INITIAL_PLATFORM_OVERVIEW: AuditPlatformOverview = {
  material_engine: {
    status: 'warning',
    total_theor_loss: 86400, // VND
    abnormal_items_count: 2,
    top_abnormal_materials: ['經典阿薩姆紅茶茶湯 (+8.7%)', '優質高脂奶精粉 (+4.4%)'],
  },
  environment_engine: {
    status: 'attention',
    hygiene_score: 87,
    critical_risk_items: [
      { item: '抹布與洗潔劑', distance_risk: true, guideline_violated: '藍色清潔工具距離加料操作台小於 60cm，具交叉污染風險。' }
    ],
  },
  service_engine: {
    status: 'pass',
    greeting_within_5s_rate: 94.2,
    customer_observation_count: 120,
    alerts: ['進門 5 秒眼神迎賓落實良好；離店送客「謝謝光臨，明天見」執行率 88%'],
  },
  food_quality_engine: {
    status: 'normal',
    boba_texture_abnormal: false,
    boba_color_status: '標準黑糖琥珀光澤 (Q彈度 4.5/5)',
    pending_inspector_confirm: 0,
  },
  material_safety_engine: {
    status: 'secure',
    scrapped_materials_in_inventory: 0,
    illegal_usage_detected: false,
    alerts: ['無逾期未報廢原料入杯紀錄；黑糖珍珠定時出鍋與 4 小時銷毀紀錄 100% 合規'],
  },
  stock_risk_engine: {
    status: 'yellow',
    shortage_items: [
      { material_name: '黑糖珍珠粉圓', days_remaining: 1.4, urgency_level: 'soon' },
      { material_name: '經典阿薩姆紅茶茶葉', days_remaining: 3.2, urgency_level: 'normal' },
    ],
  },
  marketing_compliance_engine: {
    status: 'good',
    zalo_group_new_members: 38,
    target_members: 50,
    completion_rate: 76.0,
  },
}

// ── 核心數理運算：原料消耗推算引擎 (Recipe Engine & Product Composition Model) ──

export interface CalculateParams {
  iposRecords: IPOSSalesRecord[]
  ivtRecords: IVTMovementRecord[]
  recipes: RDRecipeVersioned[]
  pricing: IngredientPricingRecord[]
  rules: AuditRule[]
  targetDate?: string
}

/**
 * 依據銷售日期精確匹配生效配方版本
 */
export function getEffectiveRecipe(
  recipes: RDRecipeVersioned[],
  productCode: string,
  dateStr: string
): RDRecipeVersioned | null {
  const targetDate = new Date(dateStr).getTime()
  const matched = recipes.filter(r => r.product_code === productCode)
  for (const r of matched) {
    const from = new Date(r.effective_from).getTime()
    const to = r.effective_to ? new Date(r.effective_to).getTime() : Infinity
    if (targetDate >= from && targetDate <= to) {
      return r
    }
  }
  return matched[0] || null
}

/**
 * 原料消耗合理性推算核心演算法 (純算法模型，不依賴 LLM 黑盒子)
 */
export function calculateMaterialRationality({
  iposRecords,
  ivtRecords,
  recipes,
  pricing,
  rules,
  targetDate = '2026-09-08',
}: CalculateParams): {
  rows: MaterialConsumptionRow[]
  totalRawLoss: number
  totalAdjustedLoss: number
  unmappedProducts: string[]
  appliedRulesSummary: { rule_code: string; title: string; count: number; status: string }[]
} {
  // 建立價格表
  const priceMap = new Map<string, number>()
  for (const p of pricing) {
    priceMap.set(p.ingredient_code, p.store_transfer_price)
  }

  // 僅使用 Approved Rule 與 Hard Rule 進行正式推算修正；Hypothesis 與 Suggested 記錄為潛在成因
  const activeRules = rules.filter(r => r.status === 'approved' || r.status === 'hard_rule')
  const appliedRulesMap = new Map<string, number>()

  // 累計純標準理論值 vs 組合修正後理論值
  const rawTheorMap = new Map<string, { name: string; unit: string; qty: number }>()
  const adjTheorMap = new Map<string, { name: string; unit: string; qty: number; applied: Set<string> }>()
  const unmappedProducts: string[] = []

  for (const pos of iposRecords) {
    const recipe = getEffectiveRecipe(recipes, pos.product_code, pos.date || targetDate)
    if (!recipe) {
      unmappedProducts.push(`${pos.product_name} (${pos.product_code})`)
      continue
    }

    const cups = pos.qty

    // 1. 基底茶 (Base Tea)
    if (recipe.base_tea_code && recipe.base_tea_amount > 0) {
      const code = recipe.base_tea_code
      const standardMl = recipe.base_tea_amount * cups

      // 純理論值 (公升)
      const currentRaw = rawTheorMap.get(code) || { name: '紅茶茶湯', unit: 'L', qty: 0 }
      currentRaw.qty += standardMl / 1000
      rawTheorMap.set(code, currentRaw)

      // 組合修正：檢查是否有加料 (Toppings) 規則
      let deltaMl = 0
      const appliedSet = new Set<string>()

      if (pos.toppings_count >= 2) {
        // 尋找 2 toppings 規則
        const r2 = activeRules.find(r => r.target_product.includes(recipe.size) && r.adjustment_type === 'tea_adjustment' && r.condition_desc.includes('2'))
        if (r2) {
          deltaMl += r2.numerical_delta * cups
          appliedSet.add(r2.rule_code)
          appliedRulesMap.set(r2.rule_code, (appliedRulesMap.get(r2.rule_code) || 0) + cups)
        }
      }

      const currentAdj = adjTheorMap.get(code) || { name: '紅茶茶湯', unit: 'L', qty: 0, applied: new Set() }
      currentAdj.qty += (standardMl + deltaMl) / 1000
      appliedSet.forEach(item => currentAdj.applied.add(item))
      adjTheorMap.set(code, currentAdj)
    }

    // 2. 奶精 (Creamer)
    if (recipe.creamer_code && (recipe.creamer_amount || 0) > 0) {
      const code = recipe.creamer_code
      const standardG = (recipe.creamer_amount || 0) * cups

      const currentRaw = rawTheorMap.get(code) || { name: '奶精粉', unit: 'kg', qty: 0 }
      currentRaw.qty += standardG / 1000
      rawTheorMap.set(code, currentRaw)

      const currentAdj = adjTheorMap.get(code) || { name: '奶精粉', unit: 'kg', qty: 0, applied: new Set() }
      currentAdj.qty += standardG / 1000
      adjTheorMap.set(code, currentAdj)
    }

    // 3. 鮮奶 (Fresh Milk)
    if (recipe.milk_code && (recipe.milk_amount || 0) > 0) {
      const code = recipe.milk_code
      const standardMl = (recipe.milk_amount || 0) * cups

      const currentRaw = rawTheorMap.get(code) || { name: '鮮奶', unit: 'L', qty: 0 }
      currentRaw.qty += standardMl / 1000
      rawTheorMap.set(code, currentRaw)

      // 檢查鮮奶補奶規則
      let deltaMl = 0
      const milkRule = activeRules.find(r => r.adjustment_type === 'milk_adjustment')
      if (milkRule) {
        deltaMl += milkRule.numerical_delta * (cups * 0.4) // 假設 40% 微冰去冰
        appliedRulesMap.set(milkRule.rule_code, (appliedRulesMap.get(milkRule.rule_code) || 0) + Math.round(cups * 0.4))
      }

      const currentAdj = adjTheorMap.get(code) || { name: '鮮奶', unit: 'L', qty: 0, applied: new Set() }
      currentAdj.qty += (standardMl + deltaMl) / 1000
      if (milkRule) currentAdj.applied.add(milkRule.rule_code)
      adjTheorMap.set(code, currentAdj)
    }

    // 4. 杯子 (Cup)
    if (recipe.cup_code) {
      const code = recipe.cup_code
      const currentRaw = rawTheorMap.get(code) || { name: '紙杯', unit: '個', qty: 0 }
      currentRaw.qty += cups
      rawTheorMap.set(code, currentRaw)

      const currentAdj = adjTheorMap.get(code) || { name: '紙杯', unit: '個', qty: 0, applied: new Set() }
      currentAdj.qty += cups
      adjTheorMap.set(code, currentAdj)
    }
  }

  // 結合 IVT 實耗進行差異比對
  const ivtMap = new Map<string, IVTMovementRecord>()
  for (const m of ivtRecords) {
    ivtMap.set(m.material_code, m)
  }

  const allMaterialCodes = new Set([...rawTheorMap.keys(), ...ivtMap.keys()])
  const rows: MaterialConsumptionRow[] = []

  let totalRawLoss = 0
  let totalAdjustedLoss = 0

  for (const code of allMaterialCodes) {
    const rawTheor = rawTheorMap.get(code)?.qty || 0
    const adjTheor = adjTheorMap.get(code)?.qty || 0
    const appliedRules = Array.from(adjTheorMap.get(code)?.applied || [])
    const ivt = ivtMap.get(code)

    const actual = ivt?.usage_month ?? (ivt ? ivt.open_qty + ivt.in_total - ivt.close_qty : 0)
    const unit = ivt?.unit || rawTheorMap.get(code)?.unit || ''
    const name = ivt?.material_name || rawTheorMap.get(code)?.name || code

    const diffQty = actual - adjTheor
    const diffPct = adjTheor > 0 ? (diffQty / adjTheor) * 100 : (actual > 0 ? 100 : 0)

    const unitPrice = priceMap.get(code) || (unit === 'L' ? 24000 : unit === 'kg' ? 82000 : 1100)
    const moneyLoss = diffQty > 0 ? diffQty * unitPrice : 0

    let anomalyLevel: MaterialConsumptionRow['anomaly_level'] = 'normal'
    if (diffPct !== null) {
      const abs = Math.abs(diffPct)
      if (abs > 15) anomalyLevel = 'critical'
      else if (abs > 8) anomalyLevel = 'high_risk'
      else if (abs > 4) anomalyLevel = 'low_risk'
    }

    const possibleCauses: string[] = []
    if (diffQty > 0) {
      if (appliedRules.length === 0 && code.includes('TEA')) {
        possibleCauses.push('尚未納入加料排擠補滿杯緣規則，請考慮建立 RULE')
      }
      possibleCauses.push('員工可能於尖峰期雪克後補茶過量')
      possibleCauses.push('桶底餘茶殘留未依 SOP 傾倒乾淨 (損耗)')
    } else if (diffQty < 0) {
      possibleCauses.push('出杯冰塊偏多或加料偏多排擠基底')
      possibleCauses.push('員工下茶手勢不足額')
    }

    totalRawLoss += (actual - rawTheor > 0 ? (actual - rawTheor) * unitPrice : 0)
    totalAdjustedLoss += moneyLoss

    rows.push({
      material_code: code,
      material_name: name,
      unit,
      raw_theoretical_qty: Math.round(rawTheor * 100) / 100,
      composition_adjusted_qty: Math.round(adjTheor * 100) / 100,
      actual_usage_qty: Math.round(actual * 100) / 100,
      diff_qty: Math.round(diffQty * 100) / 100,
      diff_pct: diffPct !== null ? Math.round(diffPct * 10) / 10 : null,
      unit_price: unitPrice,
      money_loss: Math.round(moneyLoss),
      anomaly_level: anomalyLevel,
      possible_causes: possibleCauses,
      applied_rules: appliedRules,
      trend_vs_history: '比上月同期偏差 +2.1%',
      store_vs_peers: '在周邊 5 家商圈店中排第 2 (屬中高偏差)',
    })
  }

  // 排序：高風險與金額損失優先
  rows.sort((a, b) => b.money_loss - a.money_loss)

  const appliedRulesSummary = Array.from(appliedRulesMap.entries()).map(([code, count]) => {
    const r = rules.find(x => x.rule_code === code)
    return {
      rule_code: code,
      title: r?.title || code,
      count,
      status: r?.status || 'approved',
    }
  })

  return {
    rows,
    totalRawLoss: Math.round(totalRawLoss),
    totalAdjustedLoss: Math.round(totalAdjustedLoss),
    unmappedProducts,
    appliedRulesSummary,
  }
}
