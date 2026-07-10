-- 訂房模組訂閱方案：比照 CS 模組（058/059）的作法。
-- extra_properties：加購的房源數（累加），與方案內建房源數相加即為總上限。
create table if not exists public.booking_subscriptions (
  user_id             uuid primary key references public.profiles(id) on delete cascade,
  plan                text not null default 'free',        -- free | core | pro | enterprise
  billing_cycle       text not null default 'monthly',      -- monthly | yearly
  status              text not null default 'active',       -- active | past_due | canceled
  current_period_end  timestamptz,
  extra_properties    int not null default 0,
  feature_overrides   jsonb not null default '{}',          -- 企業客製：單一帳號額外解鎖的功能
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

alter table public.booking_subscriptions enable row level security;

drop policy if exists "own booking_subscriptions" on public.booking_subscriptions;
create policy "own booking_subscriptions" on public.booking_subscriptions
  for select
  using (auth.uid() = user_id);

-- 修改方案只能由後端（service role）處理，不開放使用者自行 insert/update/delete。

-- 訂房方案升級／房源加購訂單：客戶自助升級（ECPay 一次性付款，非自動續訂）。
-- ecpay-return 依 trade_no 找到這筆，付款成功後 upsert booking_subscriptions。
create table if not exists public.booking_plan_purchases (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references public.profiles(id) on delete cascade,
  trade_no          text not null unique,
  plan              text not null,           -- core | pro | enterprise
  billing_cycle     text not null,           -- monthly | yearly
  extra_properties  int not null default 0,
  twd_amount        numeric not null,
  status            text not null default 'pending', -- pending | paid
  created_at        timestamptz not null default now(),
  paid_at           timestamptz
);

alter table public.booking_plan_purchases enable row level security;

drop policy if exists "own booking_plan_purchases" on public.booking_plan_purchases;
create policy "own booking_plan_purchases" on public.booking_plan_purchases
  for select
  using (auth.uid() = user_id);

drop policy if exists "insert own booking_plan_purchases" on public.booking_plan_purchases;
create policy "insert own booking_plan_purchases" on public.booking_plan_purchases
  for insert
  with check (auth.uid() = user_id);
