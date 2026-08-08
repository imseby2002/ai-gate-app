-- 行銷模組訂閱方案：比照 CS / 訂房模組（058/059、060）的作法。
create table if not exists public.marketing_subscriptions (
  user_id             uuid primary key references public.profiles(id) on delete cascade,
  plan                text not null default 'free',        -- free | pro | team | enterprise
  billing_cycle       text not null default 'monthly',      -- monthly | yearly
  status              text not null default 'active',       -- active | past_due | canceled
  current_period_end  timestamptz,
  feature_overrides   jsonb not null default '{}',          -- 企業客製：單一帳號額外解鎖的功能
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

alter table public.marketing_subscriptions enable row level security;

drop policy if exists "own marketing_subscriptions" on public.marketing_subscriptions;
create policy "own marketing_subscriptions" on public.marketing_subscriptions
  for select
  using (auth.uid() = user_id);

-- 修改方案只能由後端（service role）處理，不開放使用者自行 insert/update/delete。

-- 行銷方案升級訂單：客戶自助升級（ECPay 一次性付款，非自動續訂）。
-- ecpay-return 依 trade_no 找到這筆，付款成功後 upsert marketing_subscriptions。
-- twd_amount 儲存的是結帳當下用 lib/fx.ts 即時匯率換算後的整數台幣金額
-- （方案權威定價是 lib/ecpay/marketing-plans.ts 的 usdPrice，比照 booking-plans.ts／cs-plans.ts）。
create table if not exists public.marketing_plan_purchases (
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

alter table public.marketing_plan_purchases enable row level security;

drop policy if exists "own marketing_plan_purchases" on public.marketing_plan_purchases;
create policy "own marketing_plan_purchases" on public.marketing_plan_purchases
  for select
  using (auth.uid() = user_id);

drop policy if exists "insert own marketing_plan_purchases" on public.marketing_plan_purchases;
create policy "insert own marketing_plan_purchases" on public.marketing_plan_purchases
  for insert
  with check (auth.uid() = user_id);
