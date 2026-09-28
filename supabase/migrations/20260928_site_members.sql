-- =============================================
-- 官網會員：公開「加入會員」頁（/join/[key]）寫入，作為 Agent 目標任務的「會員數」KPI 來源之一
-- （另一來源為 LINE 官方帳號好友數，由 LINE Messaging API 即時讀取，不落表）
-- 寫入一律走 service-role API（/api/join/[key]），本表不開放匿名 insert
-- =============================================

CREATE TABLE IF NOT EXISTS public.site_members (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  email       TEXT,
  phone       TEXT,
  line_id     TEXT,
  source      TEXT,          -- utm_source / ref，追蹤是哪個渠道帶來的
  consent     BOOLEAN NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (email IS NOT NULL OR phone IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS site_members_owner_created_idx ON public.site_members (owner_id, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS site_members_owner_email_uniq ON public.site_members (owner_id, lower(email)) WHERE email IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS site_members_owner_phone_uniq ON public.site_members (owner_id, phone) WHERE phone IS NOT NULL;

ALTER TABLE public.site_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS site_members_owner_select ON public.site_members;
CREATE POLICY site_members_owner_select ON public.site_members
  FOR SELECT USING (owner_id = auth.uid());

INSERT INTO public.agent_tools (id, label, description, category, default_requires_approval, risk_level) VALUES
  ('get_ga4_metrics',    'GA4 官網流量', '讀取官網 GA4 sessions／使用者數／瀏覽量（唯讀）',             'marketing', false, 'low'),
  ('get_member_counts',  '會員數',       '讀取 LINE 官方帳號好友數與官網會員數，並提供加入會員連結（唯讀）', 'marketing', false, 'low')
ON CONFLICT (id) DO NOTHING;

UPDATE public.agent_roles
SET default_tool_ids = ARRAY(
  SELECT DISTINCT unnest(default_tool_ids || ARRAY['get_ga4_metrics','get_member_counts'])
)
WHERE id = 'digital-marketer';
