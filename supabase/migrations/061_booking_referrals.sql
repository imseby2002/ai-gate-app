-- 訂房推薦碼：介紹人與被介紹人成交後各贈送 30 天，不打折、不動定價，
-- 避免跟年繳促銷疊加折扣。
alter table public.booking_subscriptions
  add column if not exists referral_code text unique,
  add column if not exists bonus_days int not null default 0; -- 尚無有效付費期可延長時先記帳，下次付款一併加上

alter table public.booking_plan_purchases
  add column if not exists referral_code_used text;

-- 核銷紀錄：一個 referee 只能核銷一次推薦碼，一筆訂單只能核銷一次。
create table if not exists public.booking_referral_redemptions (
  id            uuid primary key default gen_random_uuid(),
  purchase_id   uuid not null unique references public.booking_plan_purchases(id) on delete cascade,
  referrer_id   uuid not null references public.profiles(id) on delete cascade,
  referee_id    uuid not null unique references public.profiles(id) on delete cascade,
  created_at    timestamptz not null default now()
);

alter table public.booking_referral_redemptions enable row level security;

drop policy if exists "own booking_referral_redemptions" on public.booking_referral_redemptions;
create policy "own booking_referral_redemptions" on public.booking_referral_redemptions
  for select
  using (auth.uid() = referrer_id or auth.uid() = referee_id);
