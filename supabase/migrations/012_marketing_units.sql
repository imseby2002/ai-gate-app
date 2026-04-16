-- =============================================
-- AI GATE - Migration 012
-- Marketing Automation Units (flexible unit-based data)
-- =============================================

ALTER TABLE public.marketing_campaigns
  ADD COLUMN IF NOT EXISTS unit_data     JSONB NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS unit_statuses JSONB NOT NULL DEFAULT '{}';
