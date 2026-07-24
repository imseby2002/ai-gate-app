-- =============================================
-- AI GATE - Migration 073
-- Agent 核心框架：工具中繼資料目錄（給 admin UI 顯示/開關用）
-- 實際執行邏輯寫在 src/lib/agents/tools/*.ts，此表不做動態可執行插件系統
-- =============================================

CREATE TABLE public.agent_tools (
  id                          TEXT PRIMARY KEY,   -- 對應 code registry key，如 'web_search'
  label                       TEXT NOT NULL,
  description                 TEXT NOT NULL DEFAULT '',
  category                    TEXT NOT NULL DEFAULT 'general',
  default_requires_approval   BOOLEAN NOT NULL DEFAULT false,
  risk_level                  TEXT NOT NULL DEFAULT 'low' CHECK (risk_level IN ('low','medium','high')),
  is_active                   BOOLEAN NOT NULL DEFAULT true,
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.agent_tools ENABLE ROW LEVEL SECURITY;

CREATE POLICY "agent_tools_read_authenticated" ON public.agent_tools
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "agent_tools_admin" ON public.agent_tools
  FOR ALL USING (public.is_admin());

CREATE TABLE public.agent_role_tools (
  role_id                     TEXT NOT NULL REFERENCES public.agent_roles(id) ON DELETE CASCADE,
  tool_id                     TEXT NOT NULL REFERENCES public.agent_tools(id) ON DELETE CASCADE,
  enabled                     BOOLEAN NOT NULL DEFAULT true,
  requires_approval_override  BOOLEAN,
  PRIMARY KEY (role_id, tool_id)
);

ALTER TABLE public.agent_role_tools ENABLE ROW LEVEL SECURITY;

CREATE POLICY "agent_role_tools_read_authenticated" ON public.agent_role_tools
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "agent_role_tools_admin" ON public.agent_role_tools
  FOR ALL USING (public.is_admin());
