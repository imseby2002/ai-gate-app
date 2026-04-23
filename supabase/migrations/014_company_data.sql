-- =============================================
-- AI GATE - Migration 014
-- Shared company data (global per user, not per campaign)
-- =============================================

CREATE TABLE IF NOT EXISTS public.company_data (
  user_id    UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  data       JSONB NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.company_data ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own company data"
  ON public.company_data
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION update_company_data_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

CREATE TRIGGER trg_company_data_updated_at
  BEFORE UPDATE ON public.company_data
  FOR EACH ROW EXECUTE FUNCTION update_company_data_updated_at();
