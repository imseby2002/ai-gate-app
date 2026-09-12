-- 門市營運教練 AI 公司管理規範與員工守則資料庫 (Company Regulations)
CREATE TABLE IF NOT EXISTS company_regulations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL, -- e.g. REG-FOOD-01, REG-CONDUCT-02
  title TEXT NOT NULL,
  category TEXT NOT NULL, -- 'food_safety', 'employee_conduct', 'store_safety', 'customer_crisis', 'confidentiality', 'labor_shift'
  clause_content TEXT NOT NULL,
  violation_penalty TEXT, -- 違規處分 / 罰則
  manager_enforcement TEXT, -- 店長落實與查核指引
  mandatory_level TEXT DEFAULT 'strict', -- 'strict' (嚴格紅線), 'standard' (常規規範), 'guideline' (指導原則)
  version TEXT DEFAULT '2026.1',
  status TEXT DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_company_regulations_code ON company_regulations(code);
CREATE INDEX IF NOT EXISTS idx_company_regulations_category ON company_regulations(category);
CREATE INDEX IF NOT EXISTS idx_company_regulations_level ON company_regulations(mandatory_level);
