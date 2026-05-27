-- CS 客戶追蹤：每位客戶（依平台 + 來源 ID）的累計狀態，供 AI 客服認得回頭客、
-- 記錄問價次數與洽詢階段，並提供後台追蹤名單。
create table if not exists public.cs_customers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  platform text not null default 'test',
  from_id text not null,
  industry text not null default 'homestay',
  name text,
  stage text not null default 'new',          -- new | inquiring | quoted | negotiating | won | lost
  price_ask_count int not null default 0,
  message_count int not null default 0,
  last_intent text,
  summary text,
  first_seen_at timestamptz not null default now(),
  last_message_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, platform, from_id, industry)
);

alter table public.cs_customers enable row level security;

drop policy if exists "own cs_customers" on public.cs_customers;
create policy "own cs_customers" on public.cs_customers
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index if not exists cs_customers_user_recent_idx
  on public.cs_customers (user_id, last_message_at desc);
