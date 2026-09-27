-- =============================================
-- Agent 目標任務（Mission）：只給目標＋預算 → Agent 產出計畫書 → 真人按「執行」→ Agent 全程執行
-- - agent_missions：目標、預算、KPI、計畫書、執行進度
-- - agent_mission_expenses：對外採購（外部資源）申請與核准紀錄，受預算上限控管
-- - agent_runs.mission_id：執行計畫的 run 綁回 mission
-- - 新角色 digital-marketer（網路行銷專員）與新工具種子
-- =============================================

CREATE TABLE IF NOT EXISTS public.agent_missions (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  owner_id         UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,  -- 行銷資料歸屬（公司 owner）
  role_id          TEXT NOT NULL REFERENCES public.agent_roles(id),
  objective        TEXT NOT NULL,
  budget_amount    NUMERIC(14,2) NOT NULL DEFAULT 0,
  budget_currency  TEXT NOT NULL DEFAULT 'TWD',
  deadline         DATE,
  status           TEXT NOT NULL DEFAULT 'planning'
                   CHECK (status IN ('planning','plan_ready','executing','paused','completed','cancelled','failed')),
  plan             JSONB NOT NULL DEFAULT '{}',
  kpis             JSONB NOT NULL DEFAULT '[]',   -- [{ key, name, target, unit, due, current, updated_at, source }]
  progress_log     JSONB NOT NULL DEFAULT '[]',   -- [{ at, note, kpi_updates }]
  plan_feedback    TEXT,
  budget_spent     NUMERIC(14,2) NOT NULL DEFAULT 0,
  run_id           UUID REFERENCES public.agent_runs(id) ON DELETE SET NULL,
  last_error       TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  started_at       TIMESTAMPTZ,
  completed_at     TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_agent_missions_user ON public.agent_missions(user_id, created_at DESC);

ALTER TABLE public.agent_missions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "agent_missions_own" ON public.agent_missions
  FOR SELECT USING (user_id = auth.uid() OR public.is_admin());

CREATE POLICY "agent_missions_admin" ON public.agent_missions
  FOR ALL USING (public.is_admin());

CREATE TRIGGER trg_agent_missions_updated_at
  BEFORE UPDATE ON public.agent_missions
  FOR EACH ROW EXECUTE FUNCTION public.update_agent_runs_updated_at();

CREATE TABLE IF NOT EXISTS public.agent_mission_expenses (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mission_id    UUID NOT NULL REFERENCES public.agent_missions(id) ON DELETE CASCADE,
  vendor        TEXT NOT NULL,
  description   TEXT NOT NULL DEFAULT '',
  amount        NUMERIC(14,2) NOT NULL DEFAULT 0,
  url           TEXT,
  status        TEXT NOT NULL DEFAULT 'proposed'
                CHECK (status IN ('proposed','approved','rejected','paid','cancelled')),
  approval_id   UUID REFERENCES public.agent_approvals(id) ON DELETE SET NULL,
  note          TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_agent_mission_expenses_mission ON public.agent_mission_expenses(mission_id, created_at);
CREATE INDEX IF NOT EXISTS idx_agent_mission_expenses_approval ON public.agent_mission_expenses(approval_id);

ALTER TABLE public.agent_mission_expenses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "agent_mission_expenses_own" ON public.agent_mission_expenses
  FOR SELECT USING (
    public.is_admin()
    OR EXISTS (SELECT 1 FROM public.agent_missions m WHERE m.id = mission_id AND m.user_id = auth.uid())
  );

CREATE POLICY "agent_mission_expenses_admin" ON public.agent_mission_expenses
  FOR ALL USING (public.is_admin());

ALTER TABLE public.agent_runs
  ADD COLUMN IF NOT EXISTS mission_id UUID REFERENCES public.agent_missions(id) ON DELETE SET NULL;

-- ===== 新角色：網路行銷專員 =====
INSERT INTO public.agent_roles
  (id, label, description, category, default_model_intent, default_tool_ids, approval_action_types, sort)
VALUES (
  'digital-marketer',
  '網路行銷專員',
  '只需給目標與預算（例如：1 個月內 10,000 人認識品牌、3 個月 100,000 人，或網路帶動業績成長 30%），自動盤點 marketing.im-tourist.com 既有資源、產出計畫書；按下執行後自主產出內容、排程、追蹤 KPI。內部資源不足時會找外部廠商並提出預算申請，核准後才動用。',
  'marketing',
  'creative',
  ARRAY['web_search','collect_market_data','analyze_market','draft_marketing_copy','plan_image_content','plan_video_content',
        'list_marketing_resources','get_marketing_snapshot','create_content_set','schedule_content',
        'report_mission_progress','request_external_purchase','schedule_next_check',
        'get_company_context','read_role_memory','write_memory','notify_human','request_human_approval','finish_run'],
  ARRAY['external_purchase','human_action_required','send_external_comms'],
  5
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.agent_tools (id, label, description, category, default_requires_approval, risk_level) VALUES
  ('list_marketing_resources', '盤點行銷資源', '盤點 marketing.im-tourist.com 既有品牌、商品、內容、行事曆、活動、外送通路', 'marketing', false, 'low'),
  ('get_marketing_snapshot',   '行銷成效快照', '讀取行銷成效彙整（外送營收、行銷支出、內容產出量）',                     'marketing', false, 'low'),
  ('create_content_set',       '產出整套內容', '依品牌守則產出多平台文案、短影音腳本、生圖提示、GEO 文章',               'marketing', false, 'low'),
  ('schedule_content',         '排入內容行事曆', '把內容排入行銷行事曆',                                               'marketing', false, 'low'),
  ('report_mission_progress',  '回報任務進度', '更新目標任務的 KPI 實際值與進度紀錄',                                   'core',      false, 'low'),
  ('request_external_purchase','外部採購申請', '內部資源不足時，向真人申請動用預算採購外部資源（需核准）',               'core',      false, 'high'),
  ('schedule_next_check',      '排定下次檢查', '暫停到指定時間再繼續執行（長期任務用）',                                 'core',      false, 'low')
ON CONFLICT (id) DO NOTHING;
