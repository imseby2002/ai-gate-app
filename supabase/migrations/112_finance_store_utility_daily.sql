-- =============================================
-- AI GATE - Migration 112
-- 出納：門市費用編碼、每日收支表、廠商名冊與填報系統
-- =============================================

-- 門市與費用編碼
create table if not exists public.finance_stores (
  id            uuid primary key default gen_random_uuid(),
  owner_id      uuid not null references public.profiles(id) on delete cascade,
  store_code    text not null,
  store_name    text not null default '',
  water_code    text not null default '',
  power_code    text not null default '',
  gas_code      text not null default '',
  ice_vendor_id uuid,
  created_at    timestamptz not null default now(),
  unique (owner_id, store_code)
);
create index if not exists idx_finance_stores_owner on public.finance_stores(owner_id);

-- 廠商名冊與 Token (瓦斯/冰塊廠商)
create table if not exists public.finance_vendors (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null references public.profiles(id) on delete cascade,
  vendor_name text not null,
  vendor_type text not null check (vendor_type in ('gas', 'ice', 'other')),
  token       text not null unique default encode(gen_random_bytes(16), 'hex'),
  contact     text not null default '',
  created_at  timestamptz not null default now()
);
create index if not exists idx_finance_vendors_owner on public.finance_vendors(owner_id);
create index if not exists idx_finance_vendors_token on public.finance_vendors(token);

-- 外鍵約束 (冰塊廠商)
alter table public.finance_stores
  drop constraint if exists fk_finance_stores_ice_vendor;
alter table public.finance_stores
  add constraint fk_finance_stores_ice_vendor
  foreign key (ice_vendor_id) references public.finance_vendors(id) on delete set null;

-- 每日支出收入表 (Daily Ledger)
create table if not exists public.finance_daily_ledger (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null references public.profiles(id) on delete cascade,
  store_code  text not null,
  entry_date  date not null default CURRENT_DATE,
  flow_type   text not null check (flow_type in ('income', 'expense')),
  category    text not null default 'other',
  amount      numeric not null default 0,
  source      text not null default 'manual' check (source in ('manual', 'import', 'vendor')),
  vendor_id   uuid references public.finance_vendors(id) on delete set null,
  note        text not null default '',
  created_at  timestamptz not null default now()
);
create index if not exists idx_finance_daily_period on public.finance_daily_ledger(owner_id, store_code, entry_date);

-- RLS 設定
alter table public.finance_stores enable row level security;
alter table public.finance_vendors enable row level security;
alter table public.finance_daily_ledger enable row level security;

-- Policies for finance_stores
drop policy if exists "finance_stores_owner" on public.finance_stores;
create policy "finance_stores_owner" on public.finance_stores for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());
drop policy if exists "finance_stores_admin" on public.finance_stores;
create policy "finance_stores_admin" on public.finance_stores for all using (public.is_admin());

-- Policies for finance_vendors
drop policy if exists "finance_vendors_owner" on public.finance_vendors;
create policy "finance_vendors_owner" on public.finance_vendors for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());
drop policy if exists "finance_vendors_admin" on public.finance_vendors;
create policy "finance_vendors_admin" on public.finance_vendors for all using (public.is_admin());

-- Policies for finance_daily_ledger
drop policy if exists "finance_daily_ledger_owner" on public.finance_daily_ledger;
create policy "finance_daily_ledger_owner" on public.finance_daily_ledger for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());
drop policy if exists "finance_daily_ledger_admin" on public.finance_daily_ledger;
create policy "finance_daily_ledger_admin" on public.finance_daily_ledger for all using (public.is_admin());
