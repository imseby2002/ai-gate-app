-- ===================================================================
-- AI Audit Intelligence Platform (企業稽核智慧平台) 資料表定義
-- ===================================================================

-- 1. 規則庫主表 (Audit Rules V2: 支援 4 種等級與數理係數)
CREATE TABLE IF NOT EXISTS public.audit_rules_v2 (
  id TEXT PRIMARY KEY,
  rule_code TEXT NOT NULL UNIQUE,                       -- 如 RULE-00038
  title TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'hypothesis',            -- hypothesis | suggested | approved | hard_rule
  category TEXT NOT NULL DEFAULT 'material',            -- material | hygiene | service | quality | safety | stock | marketing
  target_product TEXT NOT NULL,                         -- 適用商品 (如 珍珠奶茶 500ml)
  condition_desc TEXT NOT NULL,                         -- 適用條件 (如 2 toppings)
  adjustment_type TEXT NOT NULL,                        -- tea_adjustment | milk_adjustment | creamer_adjustment | displacement
  adjustment_value TEXT NOT NULL,                       -- 人類可讀表示法 (如 +18ml 紅茶基底)
  numerical_delta NUMERIC NOT NULL DEFAULT 0,           -- 數理調校增量 (如 18 或 -10)
  unit TEXT NOT NULL DEFAULT 'ml',                      -- 單位 (ml, g, 份)
  version TEXT NOT NULL DEFAULT 'V1',                   -- 版本號 (V1, V2, V3)
  effective_from DATE NOT NULL DEFAULT CURRENT_DATE,    -- 生效起始日期
  effective_to DATE,                                    -- 生效截止日期 (NULL 為目前持續有效)
  approved_by TEXT,                                     -- 核准主管/委員會
  hypothesis_reason TEXT,                               -- 推理假說成因與現場觀察依據
  confidence INTEGER NOT NULL DEFAULT 80,              -- AI 信心度 0-100
  store TEXT,                                           -- 指定門市 (NULL 為全門市通用)
  owner_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_rules_v2_code ON public.audit_rules_v2(rule_code);
CREATE INDEX IF NOT EXISTS idx_audit_rules_v2_status ON public.audit_rules_v2(status);
CREATE INDEX IF NOT EXISTS idx_audit_rules_v2_category ON public.audit_rules_v2(category);

-- 2. 規則變更與版本歷史表 (Rule Change History - 不可覆蓋)
CREATE TABLE IF NOT EXISTS public.audit_rule_versions (
  id TEXT PRIMARY KEY,
  rule_id TEXT NOT NULL REFERENCES public.audit_rules_v2(id) ON DELETE CASCADE,
  rule_code TEXT NOT NULL,
  version TEXT NOT NULL,                                -- V1, V2, V3
  adjustment_value TEXT NOT NULL,
  numerical_delta NUMERIC NOT NULL DEFAULT 0,
  effective_from DATE NOT NULL,
  effective_to DATE,
  approved_by TEXT NOT NULL,
  change_note TEXT NOT NULL,                            -- 版本變更備註原因
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_rule_versions_rule ON public.audit_rule_versions(rule_id);

-- 3. 商品組合耗用修正模型 (Product Composition Models)
CREATE TABLE IF NOT EXISTS public.audit_composition_models (
  id TEXT PRIMARY KEY,
  product_code TEXT NOT NULL,
  product_name TEXT NOT NULL,
  topping_count INTEGER NOT NULL DEFAULT 0,
  tea_delta_ml NUMERIC NOT NULL DEFAULT 0,
  creamer_delta_g NUMERIC NOT NULL DEFAULT 0,
  liquid_displacement_ml NUMERIC NOT NULL DEFAULT 0,
  applied_rule_code TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. 稽核自動日誌與知識圖譜 (Audit Knowledge Logs)
CREATE TABLE IF NOT EXISTS public.audit_knowledge_logs (
  id TEXT PRIMARY KEY,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  auditor_name TEXT NOT NULL,
  issue_title TEXT NOT NULL,
  store TEXT NOT NULL,
  chat_count INTEGER NOT NULL DEFAULT 1,
  findings TEXT NOT NULL,
  solution_adopted TEXT NOT NULL,
  related_rule_code TEXT,
  status TEXT NOT NULL DEFAULT 'pending_approval',      -- pending_approval | approved | rejected | upgraded_to_hard_rule
  owner_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_knowledge_logs_date ON public.audit_knowledge_logs(date);
