-- CS 方案升級訂單：客戶自助升級（ECPay 一次性付款，非自動續訂）。
-- ecpay-return 依 trade_no 找到這筆，付款成功後 upsert cs_subscriptions。
create table if not exists public.cs_plan_purchases (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.profiles(id) on delete cascade,
  trade_no      text not null unique,
  plan          text not null,           -- pro | team | enterprise
  billing_cycle text not null,           -- monthly | yearly
  twd_amount    numeric not null,
  status        text not null default 'pending', -- pending | paid
  created_at    timestamptz not null default now(),
  paid_at       timestamptz
);

alter table public.cs_plan_purchases enable row level security;

drop policy if exists "own cs_plan_purchases" on public.cs_plan_purchases;
create policy "own cs_plan_purchases" on public.cs_plan_purchases
  for select
  using (auth.uid() = user_id);

drop policy if exists "insert own cs_plan_purchases" on public.cs_plan_purchases;
create policy "insert own cs_plan_purchases" on public.cs_plan_purchases
  for insert
  with check (auth.uid() = user_id);
