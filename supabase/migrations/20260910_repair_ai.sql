-- ==============================================================================
-- FEELING TEA 奶茶門市與工廠設備＋門市POS/電腦軟硬體「維修 AI 助理」企業資料庫
-- ==============================================================================

-- 1. 設備知識庫與切片資料庫 (RAG 知識檢索庫：手冊、電路圖、故障碼、爆炸圖)
CREATE TABLE IF NOT EXISTS public.repair_knowledge_chunks (
  id TEXT PRIMARY KEY,
  equipment_model TEXT NOT NULL,          -- 如 "益芳-ET-99S", "定量果糖機-FT-16", "POS-1560"
  category TEXT NOT NULL DEFAULT 'bar',   -- bar (吧檯設備) | factory (工廠設備) | it_pos (資訊軟硬體)
  chunk_type TEXT NOT NULL,               -- error_code | circuit_diagram | troubleshooting_tree | maintenance_sop | exploded_view | real_case
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  source_file TEXT,
  safe_for_store BOOLEAN NOT NULL DEFAULT TRUE,  -- 是否適合門市快速排查 (免拆機、防呆安全)
  tech_only BOOLEAN NOT NULL DEFAULT FALSE,      -- 是否為技師專屬工程級排查 (拆機、測量阻值/電壓)
  tags TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_repair_chunks_model ON public.repair_knowledge_chunks(equipment_model);
CREATE INDEX IF NOT EXISTS idx_repair_chunks_category ON public.repair_knowledge_chunks(category);
CREATE INDEX IF NOT EXISTS idx_repair_chunks_chunk_type ON public.repair_knowledge_chunks(chunk_type);

-- 2. 設備冷啟動與機電狀態機推導庫 (Cold Start Models & State Machines)
CREATE TABLE IF NOT EXISTS public.repair_cold_start_models (
  id TEXT PRIMARY KEY,
  brand TEXT NOT NULL,
  model_name TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'bar',
  description TEXT,
  state_machine_steps JSONB DEFAULT '[]'::jsonb,
  common_error_codes JSONB DEFAULT '[]'::jsonb,
  standard_parts JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_repair_models_category ON public.repair_cold_start_models(category);

-- 3. 技師修復真實案例回饋學習庫 (Closed-loop Case Learning)
CREATE TABLE IF NOT EXISTS public.repair_case_feedbacks (
  id TEXT PRIMARY KEY,
  order_id TEXT,
  equipment_model TEXT NOT NULL,
  symptom TEXT NOT NULL,
  actual_root_cause TEXT NOT NULL,
  parts_replaced TEXT NOT NULL,
  measured_resistance_or_voltage TEXT,
  technician_note TEXT NOT NULL,
  verified_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_repair_case_model ON public.repair_case_feedbacks(equipment_model);
