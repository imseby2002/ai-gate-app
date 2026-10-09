-- =============================================
-- AI GATE - Migration 20261009 (quiz submissions lang)
-- 記錄作答者交卷時選擇的語言（zh / en / vi）
-- =============================================

alter table public.quiz_submissions add column if not exists lang text;
