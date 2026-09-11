-- 錯誤回報（bug/ai_error）一律免費、AI 自動修好、老闆確認 MERGE。
-- 功能新增/調整（feature/text_change）預設要計費，但公司若被標記免費（companies.
-- feedback_free_features）就跳過計費關卡、直接視同免費走自動修復。計費項目送出後
-- 先卡在 awaiting_approval，不會自動跑 AI，等老闆核准／報價／拒絕。
ALTER TABLE public.user_feedback
  ADD COLUMN IF NOT EXISTS contact TEXT,
  ADD COLUMN IF NOT EXISTS is_paid BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS price_quote_usd NUMERIC;

ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS feedback_free_features BOOLEAN NOT NULL DEFAULT false;
