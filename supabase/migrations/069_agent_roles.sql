-- =============================================
-- AI GATE - Migration 069
-- Agent 核心框架：角色目錄（全站，非 per-user）
-- =============================================

CREATE TABLE public.agent_roles (
  id                    TEXT PRIMARY KEY,          -- 'lead-gen', 'marketing-officer', ...
  label                 TEXT NOT NULL,
  description           TEXT NOT NULL DEFAULT '',
  category              TEXT NOT NULL DEFAULT 'general',
  default_model_intent  TEXT NOT NULL DEFAULT 'analysis',  -- 對應 lib/ai/router.ts 的 RoutingIntent
  default_tool_ids      TEXT[] NOT NULL DEFAULT '{}',
  approval_action_types TEXT[] NOT NULL DEFAULT '{}',      -- 此角色可請求核准的 action_type
  status                TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'disabled')),
  sort                  INT NOT NULL DEFAULT 0,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.agent_roles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "agent_roles_read_authenticated" ON public.agent_roles
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "agent_roles_admin" ON public.agent_roles
  FOR ALL USING (public.is_admin());

CREATE OR REPLACE FUNCTION public.update_agent_roles_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_agent_roles_updated_at
  BEFORE UPDATE ON public.agent_roles
  FOR EACH ROW EXECUTE FUNCTION public.update_agent_roles_updated_at();
