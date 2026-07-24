-- =============================================
-- AI GATE - Migration 070
-- Agent 核心框架：每用戶角色啟用/設定
-- =============================================

CREATE TABLE public.user_agent_roles (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role_id                TEXT NOT NULL REFERENCES public.agent_roles(id) ON DELETE CASCADE,
  enabled                BOOLEAN NOT NULL DEFAULT false,
  config                 JSONB NOT NULL DEFAULT '{}',   -- schedule, budget caps, tone, notify_channel override, autonomy_level
  credit_budget_monthly  NUMERIC(10,2),                 -- null = 無上限
  enabled_by             UUID REFERENCES public.profiles(id),
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role_id)
);

CREATE INDEX idx_user_agent_roles_user ON public.user_agent_roles(user_id);

ALTER TABLE public.user_agent_roles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_agent_roles_own" ON public.user_agent_roles
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "user_agent_roles_admin" ON public.user_agent_roles
  FOR ALL USING (public.is_admin());

CREATE OR REPLACE FUNCTION public.update_user_agent_roles_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_user_agent_roles_updated_at
  BEFORE UPDATE ON public.user_agent_roles
  FOR EACH ROW EXECUTE FUNCTION public.update_user_agent_roles_updated_at();
