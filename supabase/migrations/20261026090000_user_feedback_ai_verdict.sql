-- 意見反映 AI 驗收結果（done / pr_number / pr_url / evidence / checked_at）
alter table public.user_feedback add column if not exists ai_verdict jsonb;
