-- =============================================
-- AI GATE - Migration 019
-- Add compiled_md column to company_data for token-efficient AI prompts
-- =============================================

ALTER TABLE public.company_data ADD COLUMN IF NOT EXISTS compiled_md TEXT;
