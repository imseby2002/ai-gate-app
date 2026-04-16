-- =============================================
-- AI GATE - Migration 011
-- Social Platform Credentials (per user)
-- =============================================

CREATE TABLE public.social_platform_credentials (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  platform    TEXT NOT NULL,
  credentials JSONB NOT NULL DEFAULT '{}',
  is_connected BOOLEAN DEFAULT false,
  created_at  TIMESTAMPTZ DEFAULT now(),
  updated_at  TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, platform)
);

ALTER TABLE public.social_platform_credentials ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own credentials"
  ON public.social_platform_credentials
  FOR ALL USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION update_social_credentials_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_social_credentials_updated_at
  BEFORE UPDATE ON public.social_platform_credentials
  FOR EACH ROW EXECUTE FUNCTION update_social_credentials_updated_at();

CREATE INDEX idx_social_credentials_user ON public.social_platform_credentials(user_id);
