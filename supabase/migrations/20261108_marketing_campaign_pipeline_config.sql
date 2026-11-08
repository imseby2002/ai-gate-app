-- 行銷流水線設定（勾選步驟、通知、排程）改為每個專案各自存
ALTER TABLE public.marketing_campaigns ADD COLUMN IF NOT EXISTS pipeline_config JSONB;
