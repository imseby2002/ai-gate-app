-- 個人 LINE／Zalo 群組行銷排程：時間到自動通知持有人（Telegram，或 LINE 官方帳號專員名單）一鍵帶入，送出由持有人按
create table if not exists public.marketing_share_schedules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  app text not null check (app in ('line', 'zalo')),
  group_name text,
  text text not null,
  holder_id uuid references auth.users(id) on delete set null, -- null＝改用 LINE 官方帳號通知專員綁定名單
  next_run_at timestamptz not null,
  repeat text not null default 'once' check (repeat in ('once', 'daily', 'weekly')),
  status text not null default 'active' check (status in ('active', 'done', 'canceled')),
  last_sent_at timestamptz,
  last_result text,
  created_at timestamptz not null default now()
);
create index if not exists marketing_share_schedules_due_idx on public.marketing_share_schedules (status, next_run_at);
create index if not exists marketing_share_schedules_user_idx on public.marketing_share_schedules (user_id, created_at desc);
alter table public.marketing_share_schedules enable row level security;
