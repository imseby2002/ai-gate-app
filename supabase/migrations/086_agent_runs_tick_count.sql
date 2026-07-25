-- =============================================
-- AI GATE - Migration 086
-- Agent 執行安全網：總 tick 次數上限
-- =============================================
-- engine.ts 原本只有「連續錯誤達 MAX_ATTEMPTS 次」才會暫停，一個沒有出錯、
-- 但也一直不呼叫 finish_run／不觸發核准的 run 會被 cron 每分鐘一直撿起來
-- 無限期執行，唯一煞車是點數歸零。這裡加一個總 tick 次數計數，
-- 不論成功或失敗每次 tickRun 都會遞增，超過上限就暫停並通知真人。

ALTER TABLE public.agent_runs
  ADD COLUMN IF NOT EXISTS tick_count INT NOT NULL DEFAULT 0;
