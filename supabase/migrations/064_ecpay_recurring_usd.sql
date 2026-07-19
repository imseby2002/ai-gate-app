-- 064: 綠界定期定額（點數儲值／訂房方案／CS 方案自動續訂）＋ 信用卡背景扣款（低於門檻自動儲值）
-- ＋ USD 匯率快取。
--
-- 三種收費情境：
--   1) 各模組一次性購買（既有 credit_transactions / cs_plan_purchases / booking_plan_purchases 流程，不變）
--   2) 勾選「自動於下一期扣款」→ 綠界「信用卡定期定額」（固定金額、固定週期）
--      → ecpay_periodic_orders，取消由 CreditCardPeriodAction (Action=E) 處理
--   3) 點數「低於多少點數自動儲值」→ 綠界「信用卡綁定服務」背景扣款（不定期不定額）
--      → ecpay_card_bindings（綁卡狀態）＋ auto_recharge_settings（門檻／金額）

-- ===== USD ↔ TWD 即時匯率快取 =====
-- 綠界 TotalAmount／PeriodAmount 官方規定僅接受整數台幣，全站帳務改為美金後，
-- 送給綠界的請款單仍需用即時匯率換算成整數台幣；此表快取匯率，避免每次結帳都呼叫外部 API。
create table if not exists public.fx_rates (
  pair        text primary key,
  rate        numeric(12,4) not null,
  updated_at  timestamptz not null default now()
);

-- ===== 綠界信用卡綁定（供「低於門檻自動儲值」背景扣款使用） =====
create table if not exists public.ecpay_card_bindings (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null references public.profiles(id) on delete cascade,
  merchant_member_id  text not null unique,  -- 特店代號＋廠商會員編號，綠界綁卡識別碼
  card_last4          text,
  card6no             text,
  status              text not null default 'pending'
                      check (status in ('pending','active','failed','removed')),
  bound_at            timestamptz,
  removed_at          timestamptz,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create unique index if not exists ecpay_card_bindings_active_user_idx
  on public.ecpay_card_bindings (user_id)
  where status = 'active';

create index if not exists ecpay_card_bindings_user_idx
  on public.ecpay_card_bindings (user_id);

alter table public.ecpay_card_bindings enable row level security;

drop policy if exists "own ecpay_card_bindings select" on public.ecpay_card_bindings;
create policy "own ecpay_card_bindings select" on public.ecpay_card_bindings
  for select using (auth.uid() = user_id);

-- ===== 低於門檻自動儲值設定（僅點數） =====
create table if not exists public.auto_recharge_settings (
  user_id             uuid primary key references public.profiles(id) on delete cascade,
  enabled             boolean not null default false,
  threshold_usd       numeric(10,2) not null default 5,
  recharge_usd        numeric(10,2) not null default 10 check (recharge_usd >= 5),
  last_triggered_at   timestamptz,
  last_attempt_status text,  -- 'success' | 'failed' | 'pending_manual' | null
  updated_at          timestamptz not null default now()
);

alter table public.auto_recharge_settings enable row level security;

drop policy if exists "own auto_recharge_settings" on public.auto_recharge_settings;
create policy "own auto_recharge_settings" on public.auto_recharge_settings
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ===== 綠界定期定額訂單（點數自動續購／訂房方案自動續訂／CS 方案自動續訂） =====
create table if not exists public.ecpay_periodic_orders (
  id                   uuid primary key default gen_random_uuid(),
  user_id              uuid not null references public.profiles(id) on delete cascade,
  kind                 text not null check (kind in ('credit_topup','booking_plan','cs_plan')),
  reference_id         text not null,   -- 套餐/方案 id（例：pkg_10、core_monthly、pro_yearly）
  merchant_trade_no    text not null unique,  -- 建立時的綠界特店訂單編號（20碼內）
  ecpay_trade_no       text,                   -- 綠界回傳的 TradeNo（取消時需要）
  period_type          text not null default 'M' check (period_type in ('D','M','Y')),
  frequency            integer not null default 1,
  exec_times           integer not null default 99,
  period_amount_twd    integer not null,
  usd_value            numeric(10,2) not null,   -- 每期入帳金額／方案美金價
  fx_rate              numeric(12,4) not null,
  status               text not null default 'pending'
                       check (status in ('pending','active','cancelled','failed')),
  total_success_times  integer not null default 0,
  next_expected_at     timestamptz,
  cancelled_at         timestamptz,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

create index if not exists ecpay_periodic_orders_user_idx
  on public.ecpay_periodic_orders (user_id, status);

alter table public.ecpay_periodic_orders enable row level security;

drop policy if exists "own ecpay_periodic_orders select" on public.ecpay_periodic_orders;
create policy "own ecpay_periodic_orders select" on public.ecpay_periodic_orders
  for select using (auth.uid() = user_id);
