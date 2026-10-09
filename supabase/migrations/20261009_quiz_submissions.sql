-- =============================================
-- AI GATE - Migration 20261009 (quiz submissions)
-- 公開測驗頁（/quiz/*）交卷紀錄。只經由 /api/quiz/submit（service role）寫入，
-- 只在 /admin/quiz（service role）讀取；不開放任何 RLS policy。
-- =============================================

create table if not exists public.quiz_submissions (
  id          uuid primary key default gen_random_uuid(),
  quiz_id     text not null,
  name        text not null,
  answers     jsonb not null,
  score       int not null,
  total       int not null,
  user_agent  text,
  created_at  timestamptz not null default now()
);

create index if not exists quiz_submissions_quiz_created_idx
  on public.quiz_submissions (quiz_id, created_at desc);

alter table public.quiz_submissions enable row level security;
