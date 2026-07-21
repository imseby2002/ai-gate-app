-- =============================================
-- AI GATE - Migration 074
-- Agent 核心框架：長期記憶 / 自我檢討筆記
-- compiled_md 快取模式比照 company_data（migration 014/019）
-- =============================================

CREATE TABLE public.agent_memory (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role_id        TEXT NOT NULL REFERENCES public.agent_roles(id),
  memory_type    TEXT NOT NULL DEFAULT 'note' CHECK (memory_type IN ('note','lesson','preference','summary')),
  content        TEXT NOT NULL,
  tags           TEXT[] NOT NULL DEFAULT '{}',
  importance     SMALLINT NOT NULL DEFAULT 3,
  source_run_id  UUID REFERENCES public.agent_runs(id) ON DELETE SET NULL,
  expires_at     TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_agent_memory_user_role ON public.agent_memory(user_id, role_id, created_at DESC);

ALTER TABLE public.agent_memory ENABLE ROW LEVEL SECURITY;

CREATE POLICY "agent_memory_own" ON public.agent_memory
  FOR SELECT USING (user_id = auth.uid() OR public.is_admin());

CREATE POLICY "agent_memory_admin" ON public.agent_memory
  FOR ALL USING (public.is_admin());

CREATE TABLE public.agent_memory_compiled (
  user_id        UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role_id        TEXT NOT NULL REFERENCES public.agent_roles(id),
  compiled_md    TEXT NOT NULL DEFAULT '',
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, role_id)
);

ALTER TABLE public.agent_memory_compiled ENABLE ROW LEVEL SECURITY;

CREATE POLICY "agent_memory_compiled_own" ON public.agent_memory_compiled
  FOR SELECT USING (user_id = auth.uid() OR public.is_admin());

CREATE POLICY "agent_memory_compiled_admin" ON public.agent_memory_compiled
  FOR ALL USING (public.is_admin());
