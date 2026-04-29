-- =============================================
-- AI GATE - Migration 016
-- User OAuth Integrations (Google Drive, etc.)
-- =============================================

CREATE TABLE public.user_integrations (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  provider        TEXT NOT NULL,          -- 'google_drive' | 'onedrive' | 'cloudinary'
  access_token    TEXT,
  refresh_token   TEXT,
  token_expiry    TIMESTAMPTZ,
  email           TEXT,                   -- connected account email
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now(),
  UNIQUE (user_id, provider)
);

ALTER TABLE public.marketing_campaigns
  ADD COLUMN IF NOT EXISTS drive_folder_id   TEXT,
  ADD COLUMN IF NOT EXISTS drive_folder_name TEXT;

ALTER TABLE public.user_integrations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own integrations"
  ON public.user_integrations
  FOR ALL USING (auth.uid() = user_id);

CREATE TRIGGER trg_user_integrations_updated_at
  BEFORE UPDATE ON public.user_integrations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE INDEX idx_user_integrations_user_provider ON public.user_integrations(user_id, provider);
