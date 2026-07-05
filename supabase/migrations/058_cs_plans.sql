-- CS 訂閱方案：每個帳號的 CS 模組方案（free/pro/team/enterprise）。
-- 沒有這筆資料 = 視為 free，不需要替既有帳號回填資料。
create table if not exists public.cs_subscriptions (
  user_id             uuid primary key references public.profiles(id) on delete cascade,
  plan                text not null default 'free',        -- free | pro | team | enterprise
  billing_cycle       text not null default 'monthly',      -- monthly | yearly
  status              text not null default 'active',       -- active | past_due | canceled
  current_period_end  timestamptz,
  feature_overrides   jsonb not null default '{}',          -- 企業客製：單一帳號額外解鎖的功能
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

alter table public.cs_subscriptions enable row level security;

drop policy if exists "own cs_subscriptions" on public.cs_subscriptions;
create policy "own cs_subscriptions" on public.cs_subscriptions
  for select
  using (auth.uid() = user_id);

-- 修改方案只能由後端（service role）處理，不開放使用者自行 insert/update/delete。

-- CS 客製功能請求：跟「找人幫我設定」(cs_setup_requests) 分開追蹤，
-- 這裡是「幫我開發/調整功能」，不是「幫我設定既有功能」。
-- touches_db = true 一律跳過固定價，走個別報價 (quoted_usd)，不占用月配額。
create table if not exists public.cs_feature_requests (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.profiles(id) on delete cascade,
  owner_id     uuid not null references public.profiles(id) on delete cascade,
  scope        text not null default 'basic',   -- basic | advanced
  touches_db   boolean not null default false,
  description  text,
  status       text not null default 'pending', -- pending | quoted | approved | done | rejected
  quoted_usd   numeric,
  created_at   timestamptz not null default now()
);

alter table public.cs_feature_requests enable row level security;

drop policy if exists "own cs_feature_requests" on public.cs_feature_requests;
create policy "own cs_feature_requests" on public.cs_feature_requests
  for select
  using (auth.uid() = user_id);

drop policy if exists "insert own cs_feature_requests" on public.cs_feature_requests;
create policy "insert own cs_feature_requests" on public.cs_feature_requests
  for insert
  with check (auth.uid() = user_id);

create index if not exists cs_feature_requests_owner_idx
  on public.cs_feature_requests (owner_id, created_at desc);

-- 找人幫我設定：記錄這次是用掉免費額度，還是要收費（$15/$25），方便對帳。
alter table public.cs_setup_requests
  add column if not exists is_free boolean not null default false;

