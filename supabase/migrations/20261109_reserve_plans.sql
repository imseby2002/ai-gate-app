-- 預約系統方案：FREE（1 間門市、固定簡訊內容）／CORE（最多 20 間分店、自訂簡訊內容）
-- 比照 095_marketing_plans.sql 的作法：沒有訂閱資料 = free，一次性 ECPay 付款，到期即失效。
create table if not exists public.reserve_subscriptions (
  user_id             uuid primary key references public.profiles(id) on delete cascade,
  plan                text not null default 'free',        -- free | core
  billing_cycle       text not null default 'monthly',
  status              text not null default 'active',      -- active | canceled
  current_period_end  timestamptz,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

alter table public.reserve_subscriptions enable row level security;

drop policy if exists "own reserve_subscriptions" on public.reserve_subscriptions;
create policy "own reserve_subscriptions" on public.reserve_subscriptions
  for select using (auth.uid() = user_id);

create table if not exists public.reserve_plan_purchases (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.profiles(id) on delete cascade,
  trade_no      text not null unique,
  plan          text not null,
  billing_cycle text not null,
  twd_amount    numeric not null,
  status        text not null default 'pending', -- pending | paid
  created_at    timestamptz not null default now(),
  paid_at       timestamptz
);

alter table public.reserve_plan_purchases enable row level security;

drop policy if exists "own reserve_plan_purchases" on public.reserve_plan_purchases;
create policy "own reserve_plan_purchases" on public.reserve_plan_purchases
  for select using (auth.uid() = user_id);

drop policy if exists "insert own reserve_plan_purchases" on public.reserve_plan_purchases;
create policy "insert own reserve_plan_purchases" on public.reserve_plan_purchases
  for insert with check (auth.uid() = user_id);
