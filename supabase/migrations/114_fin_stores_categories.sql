-- =============================================
-- AI GATE - Migration 114
-- 出納・門市費用（階段 1）：門市/區域清單、費用科目、hr_cashflow 加門市。
-- =============================================

-- 門市清單（含編碼與區域）
create table if not exists public.fin_stores (
  id         uuid primary key default gen_random_uuid(),
  owner_id   uuid not null references public.profiles(id) on delete cascade,
  code       text not null,               -- 門市編碼
  name       text not null default '',
  region     text not null default '',    -- 區域（冰塊廠商依此分）
  active     boolean not null default true,
  created_at timestamptz not null default now(),
  unique (owner_id, code)
);
create index if not exists idx_fin_stores_owner on public.fin_stores(owner_id);

-- 費用科目（含編碼與填寫方式）
create table if not exists public.fin_expense_categories (
  id             uuid primary key default gen_random_uuid(),
  owner_id       uuid not null references public.profiles(id) on delete cascade,
  code           text not null,            -- 科目編碼
  name           text not null default '',
  entry_method   text not null default 'manual',  -- import(人工匯入) | vendor(廠商填) | manual(手動)
  vendor_service text not null default '',         -- gas | ice | ''（entry_method=vendor 時用）
  sort           int not null default 0,
  created_at     timestamptz not null default now(),
  unique (owner_id, code)
);
create index if not exists idx_fin_categories_owner on public.fin_expense_categories(owner_id);

-- 每日收支加門市欄（可掛門市）
alter table public.hr_cashflow
  add column if not exists store_code text not null default '';

alter table public.fin_stores enable row level security;
alter table public.fin_expense_categories enable row level security;

drop policy if exists "fin_stores_owner" on public.fin_stores;
create policy "fin_stores_owner" on public.fin_stores for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());
drop policy if exists "fin_stores_admin" on public.fin_stores;
create policy "fin_stores_admin" on public.fin_stores for all using (public.is_admin());

drop policy if exists "fin_categories_owner" on public.fin_expense_categories;
create policy "fin_categories_owner" on public.fin_expense_categories for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());
drop policy if exists "fin_categories_admin" on public.fin_expense_categories;
create policy "fin_categories_admin" on public.fin_expense_categories for all using (public.is_admin());
