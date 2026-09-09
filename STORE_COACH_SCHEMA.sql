-- ==============================================================================
-- FEELING TEA 門市營運教練 AI (Store Management Coach AI) 企業知識資料庫
-- ==============================================================================

-- 1. 門市平面與空間配置 (Store Layouts)
CREATE TABLE IF NOT EXISTS store_layouts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid REFERENCES companies(id) ON DELETE CASCADE,
  store_code text,
  layout_version text NOT NULL DEFAULT 'v1.0',
  floor_plan_url text,
  image_urls text[] DEFAULT '{}',
  three_d_model_url text,
  counter_position jsonb,
  cashier_position jsonb,
  tea_position jsonb,
  ice_position jsonb,
  topping_position jsonb,
  sealing_position jsonb,
  pickup_position jsonb,
  washing_position jsonb,
  storage_position jsonb,
  refrigerator_position jsonb,
  freezer_position jsonb,
  waste_position jsonb,
  customer_flow jsonb,
  staff_flow jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 2. 獨立工作站模組 (Workstations)
CREATE TABLE IF NOT EXISTS workstations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid REFERENCES companies(id) ON DELETE CASCADE,
  store_code text,
  name text NOT NULL,
  type text NOT NULL,
  location text NOT NULL,
  purpose text,
  equipment text[] DEFAULT '{}',
  tools text[] DEFAULT '{}',
  ingredients text[] DEFAULT '{}',
  standard_position jsonb,
  frequency_of_use text DEFAULT 'high_peak',
  ergonomic_score int DEFAULT 85,
  efficiency_score int DEFAULT 85,
  hygiene_score int DEFAULT 90,
  safety_score int DEFAULT 95,
  notes text,
  created_at timestamptz DEFAULT now()
);

-- 3. 人員走位與交叉位分析 (Staff Movements)
CREATE TABLE IF NOT EXISTS staff_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid REFERENCES companies(id) ON DELETE CASCADE,
  workstation_id uuid REFERENCES workstations(id) ON DELETE SET NULL,
  task text NOT NULL,
  start_position text NOT NULL,
  end_position text NOT NULL,
  distance_meters numeric(5,2) DEFAULT 0,
  estimated_seconds int DEFAULT 0,
  frequency_per_hour int DEFAULT 1,
  cross_traffic boolean DEFAULT false,
  bottleneck text,
  recommended_route text,
  notes text,
  created_at timestamptz DEFAULT now()
);

-- 4. 門市營運最佳實務 (Store Best Practices)
CREATE TABLE IF NOT EXISTS store_best_practices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category text NOT NULL,
  title text NOT NULL,
  problem text NOT NULL,
  recommended_method text NOT NULL,
  why text NOT NULL,
  expected_benefit text,
  time_saved_seconds int DEFAULT 0,
  quality_improvement text,
  hygiene_improvement text,
  cost_impact text,
  source text DEFAULT 'feeling_tea_standard',
  evidence_level text DEFAULT 'verified_in_field',
  applicable_store_type text[] DEFAULT '{"mall_kiosk","street_store"}',
  created_at timestamptz DEFAULT now()
);

-- 5. 衛生品管標準 (Hygiene Standards - GOOD vs BAD)
CREATE TABLE IF NOT EXISTS hygiene_standards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category text NOT NULL,
  area text NOT NULL,
  standard text NOT NULL,
  acceptable_condition text[] NOT NULL,
  unacceptable_condition text[] NOT NULL,
  critical_limit text,
  inspection_method text,
  frequency text DEFAULT 'every_2_hours',
  responsible_role text DEFAULT 'barista',
  source text DEFAULT 'vietnam_food_law_haccp',
  risk_level text NOT NULL DEFAULT 'medium',
  created_at timestamptz DEFAULT now()
);

-- 6. 90 秒快速清潔工藝庫 (Cleaning Best Practices)
CREATE TABLE IF NOT EXISTS cleaning_best_practices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  area text NOT NULL,
  problem text,
  cleaning_method text NOT NULL,
  tools text[] DEFAULT '{}',
  chemical text,
  sequence jsonb NOT NULL,
  estimated_time_seconds int DEFAULT 90,
  frequency text DEFAULT 'after_each_rush',
  quality_score int DEFAULT 95,
  hygiene_score int DEFAULT 95,
  labor_score int DEFAULT 90,
  best_practice_tips text,
  source text DEFAULT 'lean_5s_standard',
  created_at timestamptz DEFAULT now()
);

-- 7. 稽核查核項目與結果 (Inspection Items & Results)
CREATE TABLE IF NOT EXISTS inspection_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category text NOT NULL,
  item text NOT NULL,
  standard text NOT NULL,
  criticality text DEFAULT 'major',
  inspection_method text,
  pass_condition text,
  fail_condition text,
  corrective_action text,
  version text DEFAULT '2026.1',
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS inspection_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid REFERENCES companies(id) ON DELETE CASCADE,
  inspection_id uuid,
  item_id uuid REFERENCES inspection_items(id) ON DELETE SET NULL,
  result text NOT NULL DEFAULT 'pass',
  score numeric(5,2) DEFAULT 100,
  photo_urls text[] DEFAULT '{}',
  comment text,
  corrective_action text,
  deadline timestamptz,
  responsible_person text,
  resolved boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- 8. 員工服務行為框架 (Service Behaviors)
CREATE TABLE IF NOT EXISTS service_behaviors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category text NOT NULL,
  behavior text NOT NULL,
  definition text NOT NULL,
  good_example text NOT NULL,
  bad_example text NOT NULL,
  customer_effect text,
  manager_coaching text,
  training_method text,
  evaluation_method text,
  created_at timestamptz DEFAULT now()
);

-- 9. 店長帶人對話劇本與教導法 (Coaching Methods)
CREATE TABLE IF NOT EXISTS coaching_methods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  skill text NOT NULL,
  employee_level text DEFAULT 'junior',
  situation text NOT NULL,
  coaching_method text NOT NULL,
  example_dialogue text NOT NULL,
  demonstration_guide text,
  practice_exercise text,
  feedback_framework text,
  follow_up_period text DEFAULT '3_days',
  common_mistakes text,
  created_at timestamptz DEFAULT now()
);

-- 10. 員工 5 級能力梯隊 (Employee Competencies)
CREATE TABLE IF NOT EXISTS employee_competencies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role text NOT NULL,
  competency text NOT NULL,
  level_1 text NOT NULL,
  level_2 text NOT NULL,
  level_3 text NOT NULL,
  level_4 text NOT NULL,
  level_5 text NOT NULL,
  definition text,
  training_modules text[] DEFAULT '{}',
  assessment_criteria text,
  created_at timestamptz DEFAULT now()
);

-- 11. 店長能力模型 (Store Manager Competencies)
CREATE TABLE IF NOT EXISTS store_manager_competencies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  competency_area text NOT NULL,
  title text NOT NULL,
  level_description jsonb,
  daily_checklist text[] DEFAULT '{}',
  diagnostic_prompt text,
  created_at timestamptz DEFAULT now()
);

-- 12. 10 層問題診斷庫 (Store Problems)
CREATE TABLE IF NOT EXISTS store_problems (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid REFERENCES companies(id) ON DELETE CASCADE,
  store_code text,
  problem_category text NOT NULL, -- product, process, people, equipment, environment, customer, marketing, management, supplier, regulation
  problem text NOT NULL,
  symptom text NOT NULL,
  frequency text DEFAULT 'daily_rush',
  severity text DEFAULT 'medium',
  root_cause text,
  solution text NOT NULL,
  solution_result text,
  verified boolean DEFAULT false,
  time_saved_percent numeric(4,1) DEFAULT 0,
  related_product_id uuid,
  related_shift text,
  created_at timestamptz DEFAULT now()
);

-- 13. 跨店智慧記憶庫 (Store Problem Memory)
CREATE TABLE IF NOT EXISTS store_problem_memory (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  similarity_tags text[] DEFAULT '{}',
  problem_pattern text NOT NULL,
  root_cause_pattern text NOT NULL,
  proven_solution text NOT NULL,
  success_metrics text,
  applied_count int DEFAULT 1,
  source_store_name text DEFAULT '示範門市',
  created_at timestamptz DEFAULT now()
);

-- 14. 門市 Zalo 私群與帳號資產 (Store Zalo Accounts)
CREATE TABLE IF NOT EXISTS store_zalo_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid REFERENCES companies(id) ON DELETE CASCADE,
  store_code text,
  account_type text NOT NULL, -- zalo_oa, zalo_group, zalo_zns
  account_name text NOT NULL,
  account_id text,
  url text,
  admin_name text,
  followers_or_members int DEFAULT 0,
  active_members int DEFAULT 0,
  monthly_growth_rate numeric(5,2) DEFAULT 0,
  last_activity_date date DEFAULT CURRENT_DATE,
  created_at timestamptz DEFAULT now()
);

-- 15. 企業文化與品質堅持哲學 (Company Principles)
CREATE TABLE IF NOT EXISTS company_principles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category text NOT NULL,
  principle text NOT NULL,
  meaning text NOT NULL,
  why text NOT NULL,
  good_example text NOT NULL,
  bad_example text NOT NULL,
  manager_action text,
  employee_action text,
  version text DEFAULT '2026.1',
  created_at timestamptz DEFAULT now()
);

-- 16. 門市營運教練 AI 知識餵入與學習資料庫 (Store Learning Materials)
CREATE TABLE IF NOT EXISTS store_learning_materials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_code text DEFAULT 'ALL',
  title text NOT NULL,
  source_type text NOT NULL, -- 'sop_manual', 'audit_report', 'complaint_case', 'supervisor_guide', 'external_benchmark', 'video_url', 'owner_memo'
  source_url text,
  raw_content text NOT NULL,
  ai_summary text,
  dimension text NOT NULL, -- 'sop', 'workflow', 'workstation', 'layout', 'movement', 'hygiene', 'coaching', 'problem_memory'
  key_takeaways jsonb DEFAULT '[]'::jsonb,
  actionable_rules jsonb DEFAULT '[]'::jsonb,
  evidence_level text DEFAULT 'B', -- 'A' (總部SOP), 'B' (督導實證), 'C' (店長經驗), 'D' (外部標竿)
  status text DEFAULT 'active', -- 'active', 'archived', 'reviewing'
  author_role text DEFAULT '門市督導/店長',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 索引優化
CREATE INDEX IF NOT EXISTS idx_store_layouts_store ON store_layouts(store_id);
CREATE INDEX IF NOT EXISTS idx_workstations_store ON workstations(store_id);
CREATE INDEX IF NOT EXISTS idx_staff_movements_store ON staff_movements(store_id);
CREATE INDEX IF NOT EXISTS idx_store_problems_store ON store_problems(store_id);
CREATE INDEX IF NOT EXISTS idx_inspection_results_store ON inspection_results(store_id);
CREATE INDEX IF NOT EXISTS idx_store_learning_store_code ON store_learning_materials(store_code);
CREATE INDEX IF NOT EXISTS idx_store_learning_dimension ON store_learning_materials(dimension);

