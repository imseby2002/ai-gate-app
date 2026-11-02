-- 考卷開放作答時間（空白＝不限）
alter table public.exams add column if not exists opens_at timestamptz, add column if not exists closes_at timestamptz;
