-- =============================================
-- AI GATE - Migration 009
-- Marketing Automation Campaigns
-- =============================================

CREATE TABLE public.marketing_campaigns (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,

  -- Basic info
  title           TEXT NOT NULL DEFAULT '未命名行銷活動',
  topic           TEXT,
  industry        TEXT,
  company_name    TEXT,
  company_info    TEXT,

  -- Pipeline step statuses (stored as jsonb map: step_id → status)
  step_statuses   JSONB NOT NULL DEFAULT '{}',

  -- Generated content per step
  collected_data  TEXT,
  analysis        TEXT,
  metrics         JSONB,          -- { opportunity, competitors, audience }
  copy_text       TEXT,
  image_urls      JSONB,          -- string[]
  script_text     TEXT,
  video_job_id    TEXT,

  -- Telegram settings
  telegram_chat_id  TEXT,
  selected_platforms JSONB DEFAULT '["Facebook","Instagram"]',

  -- Feedback per telegram step (step_id → feedback string)
  feedbacks       JSONB NOT NULL DEFAULT '{}',

  -- Current active step
  active_step     INT NOT NULL DEFAULT 1,

  -- Overall status
  status          TEXT NOT NULL DEFAULT 'draft'
                  CHECK (status IN ('draft','running','completed','archived')),

  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);

-- Telegram approval events (incoming webhook messages)
CREATE TABLE public.marketing_telegram_events (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id     UUID REFERENCES public.marketing_campaigns(id) ON DELETE CASCADE,
  step_id         INT NOT NULL,
  telegram_user   TEXT,
  message_text    TEXT NOT NULL,
  action          TEXT CHECK (action IN ('approved', 'feedback', 'unknown')),
  created_at      TIMESTAMPTZ DEFAULT now()
);

-- RLS
ALTER TABLE public.marketing_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketing_telegram_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own campaigns"
  ON public.marketing_campaigns
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users view own events"
  ON public.marketing_telegram_events
  FOR SELECT USING (
    campaign_id IN (
      SELECT id FROM public.marketing_campaigns WHERE user_id = auth.uid()
    )
  );

-- Service role can insert telegram events (webhook)
CREATE POLICY "Service role insert events"
  ON public.marketing_telegram_events
  FOR INSERT WITH CHECK (true);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_marketing_campaign_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_marketing_campaigns_updated_at
  BEFORE UPDATE ON public.marketing_campaigns
  FOR EACH ROW EXECUTE FUNCTION update_marketing_campaign_updated_at();

-- Index for fast user lookups
CREATE INDEX idx_marketing_campaigns_user_id ON public.marketing_campaigns(user_id);
CREATE INDEX idx_marketing_telegram_events_campaign ON public.marketing_telegram_events(campaign_id, step_id);
