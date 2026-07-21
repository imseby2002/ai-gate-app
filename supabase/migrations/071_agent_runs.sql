-- =============================================
-- AI GATE - Migration 071
-- Agent 核心框架：可續跑的執行實例 + 逐步稽核紀錄
-- =============================================

CREATE TABLE public.agent_runs (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id              UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role_id              TEXT NOT NULL REFERENCES public.agent_roles(id),
  user_role_id         UUID REFERENCES public.user_agent_roles(id) ON DELETE SET NULL,
  status               TEXT NOT NULL DEFAULT 'queued'
                       CHECK (status IN ('queued','running','waiting_approval','waiting_input','paused','completed','failed','cancelled')),
  trigger_type         TEXT NOT NULL DEFAULT 'manual'
                       CHECK (trigger_type IN ('manual','schedule','event','followup_approval')),
  goal                 TEXT NOT NULL DEFAULT '',
  input                JSONB NOT NULL DEFAULT '{}',
  messages             JSONB NOT NULL DEFAULT '[]',   -- persisted LLM 對話紀錄，用於續跑
  state                JSONB NOT NULL DEFAULT '{}',   -- 計畫/暫存變數
  current_step_index   INT NOT NULL DEFAULT 0,
  attempt_count        INT NOT NULL DEFAULT 0,
  next_tick_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  locked_at            TIMESTAMPTZ,
  locked_by            TEXT,
  total_credits_spent  NUMERIC(10,4) NOT NULL DEFAULT 0,
  last_error           TEXT,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at         TIMESTAMPTZ
);

CREATE INDEX idx_agent_runs_due ON public.agent_runs(status, next_tick_at)
  WHERE status IN ('queued', 'running');
CREATE INDEX idx_agent_runs_user ON public.agent_runs(user_id, created_at DESC);

ALTER TABLE public.agent_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "agent_runs_own" ON public.agent_runs
  FOR SELECT USING (user_id = auth.uid() OR public.is_admin());

CREATE POLICY "agent_runs_admin" ON public.agent_runs
  FOR ALL USING (public.is_admin());

CREATE OR REPLACE FUNCTION public.update_agent_runs_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_agent_runs_updated_at
  BEFORE UPDATE ON public.agent_runs
  FOR EACH ROW EXECUTE FUNCTION public.update_agent_runs_updated_at();

-- ===== 逐步稽核紀錄 =====
CREATE TABLE public.agent_run_steps (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id        UUID NOT NULL REFERENCES public.agent_runs(id) ON DELETE CASCADE,
  step_index    INT NOT NULL,
  phase         TEXT NOT NULL CHECK (phase IN (
                  'plan','tool_call','tool_result','self_critique',
                  'notify','approval_requested','approval_resolved','error','final_report'
                )),
  tool_id       TEXT,
  tool_input    JSONB,
  tool_output   JSONB,
  thought       TEXT,
  model_id      TEXT,
  input_tokens  INT,
  output_tokens INT,
  credits_spent NUMERIC(10,4) NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_agent_run_steps_run ON public.agent_run_steps(run_id, step_index);

ALTER TABLE public.agent_run_steps ENABLE ROW LEVEL SECURITY;

CREATE POLICY "agent_run_steps_own" ON public.agent_run_steps
  FOR SELECT USING (
    public.is_admin()
    OR EXISTS (SELECT 1 FROM public.agent_runs r WHERE r.id = run_id AND r.user_id = auth.uid())
  );

CREATE POLICY "agent_run_steps_admin" ON public.agent_run_steps
  FOR ALL USING (public.is_admin());

-- ===== 併發安全的到期 run 搶佔 =====
CREATE OR REPLACE FUNCTION public.claim_due_agent_runs(p_limit INT, p_worker TEXT)
RETURNS SETOF public.agent_runs
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  RETURN QUERY
  UPDATE public.agent_runs r
  SET locked_at = now(), locked_by = p_worker
  FROM (
    SELECT id FROM public.agent_runs
    WHERE status IN ('queued', 'running')
      AND next_tick_at <= now()
      AND (locked_at IS NULL OR locked_at < now() - INTERVAL '5 minutes')
    ORDER BY next_tick_at
    LIMIT p_limit
    FOR UPDATE SKIP LOCKED
  ) due
  WHERE r.id = due.id
  RETURNING r.*;
END;
$$;
