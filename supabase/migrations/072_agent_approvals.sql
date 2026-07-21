-- =============================================
-- AI GATE - Migration 072
-- Agent 核心框架：跨管道通用核准表
-- 泛化 telegram_approvals（migration 015）：chat_id/message_id → channel/channel_thread_id
-- telegram_approvals 本身不動，行銷 pipeline 繼續沿用舊表
-- =============================================

CREATE TABLE public.agent_approvals (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id               UUID REFERENCES public.agent_runs(id) ON DELETE CASCADE,
  user_id              UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role_id              TEXT REFERENCES public.agent_roles(id),
  action_type          TEXT NOT NULL,       -- 'spend_money' | 'sign_contract' | 'send_external_comms' | 'make_call' ...
  summary              TEXT NOT NULL,
  details              JSONB NOT NULL DEFAULT '{}',
  risk_level           TEXT NOT NULL DEFAULT 'medium' CHECK (risk_level IN ('low','medium','high')),
  channel              TEXT NOT NULL CHECK (channel IN
                       ('telegram','email','line','whatsapp','whatsapp-personal','zalo','sms','in_app')),
  channel_thread_id    TEXT,                -- chat_id / email Message-ID / phone E.164 / LINE userId
  external_message_id  TEXT,
  status               TEXT NOT NULL DEFAULT 'pending'
                       CHECK (status IN ('pending','approved','rejected','awaiting_feedback','feedback','expired','cancelled')),
  feedback             TEXT,
  requested_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  responded_at         TIMESTAMPTZ,
  expires_at           TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '24 hours'),
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_agent_approvals_user_status ON public.agent_approvals(user_id, status)
  WHERE status IN ('pending', 'awaiting_feedback');
CREATE INDEX idx_agent_approvals_channel_thread ON public.agent_approvals(channel, channel_thread_id, status);
CREATE INDEX idx_agent_approvals_run ON public.agent_approvals(run_id);

ALTER TABLE public.agent_approvals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "agent_approvals_own" ON public.agent_approvals
  FOR SELECT USING (user_id = auth.uid() OR public.is_admin());

CREATE POLICY "agent_approvals_admin" ON public.agent_approvals
  FOR ALL USING (public.is_admin());
