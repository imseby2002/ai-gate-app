-- =============================================
-- AI GATE - Migration 075
-- Agent 核心框架：使用者通知管道偏好
-- 各角色可在 user_agent_roles.config.notify_channel 覆蓋此預設值
-- =============================================

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS preferred_notify_channel TEXT NOT NULL DEFAULT 'telegram',
  ADD COLUMN IF NOT EXISTS preferred_notify_target  JSONB NOT NULL DEFAULT '{}';
