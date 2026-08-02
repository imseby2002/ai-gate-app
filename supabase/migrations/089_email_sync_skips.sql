-- Email 訂單擷取失敗/略過的信件持久化記錄，讓「這封信到底發生什麼事」事後可查。
-- 舊有的 debug.log 只存在單次 sync 呼叫的記憶體中，cron 背景執行時完全遺失。
create table if not exists public.email_sync_skips (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  email_setting_id uuid references public.email_settings(id) on delete cascade,
  platform text,
  subject text,
  from_address text,
  reason text not null,
  detail text,
  body_snippet text,
  created_at timestamptz not null default now()
);

create index if not exists idx_email_sync_skips_user_created on public.email_sync_skips (user_id, created_at desc);

alter table public.email_sync_skips enable row level security;

create policy "email_sync_skips_select_own" on public.email_sync_skips
  for select using (user_id = auth.uid());
