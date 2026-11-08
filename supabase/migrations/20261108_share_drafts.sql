-- 個人 LINE／Zalo 群組一鍵帶入：系統準備好的文案草稿（持有人點 /gs/<id> 用 LINE 分享連結或手機分享選單帶入）
create table if not exists public.marketing_share_drafts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  app text not null check (app in ('line', 'zalo')),
  group_name text,
  text text not null,
  notified_count integer not null default 0,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '14 days'
);
create index if not exists marketing_share_drafts_user_idx on public.marketing_share_drafts (user_id, created_at desc);
alter table public.marketing_share_drafts enable row level security;
