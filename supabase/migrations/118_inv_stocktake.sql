-- =============================================
-- AI GATE - Migration 118
-- 門市盤點・訂貨：安全庫存表（每門市）、盤點單、盤點明細。
-- 規則：實盤 ≤ 安全量 → 訂貨補到滿倉量。
-- =============================================

-- 安全庫存表（每門市 × 每原料：安全量／滿倉量）
create table if not exists public.inv_safety_stock (
  id            uuid primary key default gen_random_uuid(),
  owner_id      uuid not null references public.profiles(id) on delete cascade,
  store         text not null,
  material_code text not null,
  material_name text not null default '',
  unit          text not null default '',
  safety_qty    numeric not null default 0,   -- 安全量（低於此就要補）
  full_qty      numeric not null default 0,   -- 滿倉量（補到此）
  updated_at    timestamptz not null default now(),
  unique (owner_id, store, material_code)
);
create index if not exists idx_inv_safety_store on public.inv_safety_stock(owner_id, store);

-- 盤點單（一次盤點 = 一張）
create table if not exists public.inv_stocktakes (
  id         uuid primary key default gen_random_uuid(),
  owner_id   uuid not null references public.profiles(id) on delete cascade,
  store      text not null,
  taken_on   date not null default current_date,
  note       text not null default '',
  created_at timestamptz not null default now()
);
create index if not exists idx_inv_stocktakes_store on public.inv_stocktakes(owner_id, store, taken_on);

-- 盤點明細（各原料實盤數）
create table if not exists public.inv_stocktake_items (
  id            uuid primary key default gen_random_uuid(),
  stocktake_id  uuid not null references public.inv_stocktakes(id) on delete cascade,
  owner_id      uuid not null references public.profiles(id) on delete cascade,
  material_code text not null,
  material_name text not null default '',
  unit          text not null default '',
  counted_qty   numeric not null default 0,
  unique (stocktake_id, material_code)
);
create index if not exists idx_inv_stocktake_items on public.inv_stocktake_items(stocktake_id);

alter table public.inv_safety_stock enable row level security;
alter table public.inv_stocktakes enable row level security;
alter table public.inv_stocktake_items enable row level security;

drop policy if exists "inv_safety_owner" on public.inv_safety_stock;
create policy "inv_safety_owner" on public.inv_safety_stock for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());
drop policy if exists "inv_safety_admin" on public.inv_safety_stock;
create policy "inv_safety_admin" on public.inv_safety_stock for all using (public.is_admin());

drop policy if exists "inv_stocktakes_owner" on public.inv_stocktakes;
create policy "inv_stocktakes_owner" on public.inv_stocktakes for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());
drop policy if exists "inv_stocktakes_admin" on public.inv_stocktakes;
create policy "inv_stocktakes_admin" on public.inv_stocktakes for all using (public.is_admin());

drop policy if exists "inv_stocktake_items_owner" on public.inv_stocktake_items;
create policy "inv_stocktake_items_owner" on public.inv_stocktake_items for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());
drop policy if exists "inv_stocktake_items_admin" on public.inv_stocktake_items;
create policy "inv_stocktake_items_admin" on public.inv_stocktake_items for all using (public.is_admin());
