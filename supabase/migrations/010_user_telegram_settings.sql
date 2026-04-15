-- =============================================
-- AI GATE - Migration 010
-- Per-user Telegram integration settings
-- =============================================

-- Add Telegram fields to user profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS telegram_bot_token  TEXT,
  ADD COLUMN IF NOT EXISTS telegram_chat_id    TEXT;

-- Add poll offset tracking to marketing campaigns
-- (used when polling user's bot via getUpdates)
ALTER TABLE public.marketing_campaigns
  ADD COLUMN IF NOT EXISTS telegram_last_update_id BIGINT DEFAULT 0;

-- Note: telegram_bot_token is sensitive — RLS already restricts
-- profiles to the owner, so it is safe to store here.
-- Recommend encrypting at rest via Supabase Vault in production.
