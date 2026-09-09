-- 門市營運教練 AI 知識餵入與學習資料庫
CREATE TABLE IF NOT EXISTS store_learning_materials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_code TEXT DEFAULT 'ALL',
  title TEXT NOT NULL,
  source_type TEXT NOT NULL, -- 'sop_manual', 'audit_report', 'complaint_case', 'supervisor_guide', 'external_benchmark', 'video_url', 'owner_memo'
  source_url TEXT,
  raw_content TEXT NOT NULL,
  ai_summary TEXT,
  dimension TEXT NOT NULL, -- 'sop', 'workflow', 'workstation', 'layout', 'movement', 'hygiene', 'coaching', 'problem_memory'
  key_takeaways JSONB DEFAULT '[]'::jsonb,
  actionable_rules JSONB DEFAULT '[]'::jsonb,
  evidence_level TEXT DEFAULT 'B', -- 'A' (總部SOP), 'B' (督導實證), 'C' (店長經驗), 'D' (外部標竿)
  status TEXT DEFAULT 'active', -- 'active', 'archived', 'reviewing'
  author_role TEXT DEFAULT '門市督導/店長',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_store_learning_store_code ON store_learning_materials(store_code);
CREATE INDEX IF NOT EXISTS idx_store_learning_dimension ON store_learning_materials(dimension);
CREATE INDEX IF NOT EXISTS idx_store_learning_source_type ON store_learning_materials(source_type);
