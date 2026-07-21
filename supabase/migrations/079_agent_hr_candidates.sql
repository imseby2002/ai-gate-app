-- =============================================
-- AI GATE - Migration 079
-- Agent 框架 Phase 3：HR 履歷篩選專員（hr-recruiter）
-- 注意：這是「公司內部」的應徵者追蹤表，與既有 resume 模組（求職者端功能）
-- 完全獨立，不可混用。
-- =============================================

CREATE TABLE public.agent_hr_candidates (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name         TEXT NOT NULL,
  email        TEXT,
  phone        TEXT,
  position     TEXT,
  resume_text  TEXT,
  resume_url   TEXT,
  source       TEXT,
  stage        TEXT NOT NULL DEFAULT 'new'
               CHECK (stage IN ('new','screening','interview_scheduled','interviewed','offered','rejected','hired')),
  score        SMALLINT,
  notes        TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_agent_hr_candidates_user ON public.agent_hr_candidates(user_id, stage, created_at DESC);

ALTER TABLE public.agent_hr_candidates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "agent_hr_candidates_own" ON public.agent_hr_candidates
  FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE POLICY "agent_hr_candidates_admin" ON public.agent_hr_candidates
  FOR ALL USING (public.is_admin());

CREATE OR REPLACE FUNCTION public.update_agent_hr_candidates_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_agent_hr_candidates_updated_at
  BEFORE UPDATE ON public.agent_hr_candidates
  FOR EACH ROW EXECUTE FUNCTION public.update_agent_hr_candidates_updated_at();

INSERT INTO public.agent_tools (id, label, description, category, default_requires_approval, risk_level) VALUES
  ('list_candidates',        '列出應徵者',     '列出目前追蹤中的應徵者名單',                 'hr', false, 'low'),
  ('update_candidate_stage', '更新應徵狀態',   '更新應徵者的洽詢階段/評分/備註（內部紀錄）', 'hr', false, 'low'),
  ('send_candidate_email',   '寄送應徵者郵件', '寄送 email 給應徵者（如面試邀約、感謝信），真的會送達應徵者信箱', 'hr', true, 'high')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.agent_roles
  (id, label, description, category, default_model_intent, default_tool_ids, approval_action_types, sort)
VALUES
  (
    'hr-recruiter',
    'HR 履歷篩選專員',
    '自動篩選履歷、評估與職缺的符合度，安排面試時間邀約。寄送面試邀約/結果通知等真的會送到應徵者信箱的動作，需真人核准。',
    'hr',
    'analysis',
    ARRAY['list_candidates', 'update_candidate_stage', 'send_candidate_email', 'get_company_context', 'read_role_memory', 'write_memory', 'notify_human', 'request_human_approval', 'finish_run'],
    ARRAY['send_external_comms'],
    40
  )
ON CONFLICT (id) DO NOTHING;
