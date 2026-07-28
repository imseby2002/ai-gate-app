-- =============================================
-- AI GATE - Migration 086
-- Agent 框架：待核准事項的提醒機制
-- 用於「需要真人親自操作的動作」（例如開設 Facebook 粉專/LINE 官方帳號 ——
-- 這類動作平台本身就要求真人身分驗證，Agent 無法代勞，只能規劃步驟請真人執行）：
-- Agent 用既有的 request_human_approval 送出步驟清單，真人做完後回來核准。
-- 若真人一直沒回應，cron 會定期重新提醒，不需要另外建立新的資料表或狀態機。
-- =============================================

ALTER TABLE public.agent_approvals
  ADD COLUMN IF NOT EXISTS last_reminded_at TIMESTAMPTZ;
