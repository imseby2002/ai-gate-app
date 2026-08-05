-- AI 自由生成官網設計：非四種固定模板時，完整設計 token 存這裡
-- template_id = 'custom' 時，前端改用 custom_design 而非套用固定模板
alter table public.bnb_profiles
  add column if not exists custom_design jsonb;
