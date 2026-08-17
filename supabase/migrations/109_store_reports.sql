-- =============================================
-- AI GATE - Migration 109
-- 門市報表（階段 1）：POS 售出 + 進銷存 匯入儲存，供每門市業績／支出報表。
-- 差異分析（配方 BOM × 售出）為後續階段。
-- owner-scoped，RLS：owner + admin。
-- =============================================

-- POS 售出（每門市每月每產品）
create table if not exists public.inv_pos_sales (
  id           uuid primary key default gen_random_uuid(),
  owner_id     uuid not null references public.profiles(id) on delete cascade,
  store        text not null,
  year         int  not null,
  month        int  not null check (month between 1 and 12),
  product_code text not null default '',
  product_name text not null default '',
  qty          numeric not null default 0,   -- 售出杯數
  revenue      numeric not null default 0,   -- 營收
  unique (owner_id, store, year, month, product_code, product_name)
);
create index if not exists idx_inv_pos_period on public.inv_pos_sales(owner_id, store, year, month);

-- 進銷存異動（每門市每月每原料）
create table if not exists public.inv_movements (
  id            uuid primary key default gen_random_uuid(),
  owner_id      uuid not null references public.profiles(id) on delete cascade,
  store         text not null,
  year          int  not null,
  month         int  not null check (month between 1 and 12),
  material_code text not null,
  material_name text not null default '',
  unit          text not null default '',
  open_qty      numeric not null default 0,   -- 期初數量
  open_value    numeric not null default 0,   -- 期初金額
  in_total      numeric not null default 0,   -- 期內總入庫
  in_value      numeric not null default 0,   -- 進貨金額
  out_pos       numeric not null default 0,   -- POS 售出出庫
  out_total     numeric not null default 0,   -- 期內總出庫（使用量）
  out_value     numeric not null default 0,   -- 出庫金額
  close_qty     numeric not null default 0,   -- 期末數量（剩餘）
  close_value   numeric not null default 0,   -- 期末金額
  unique (owner_id, store, year, month, material_code)
);
create index if not exists idx_inv_mov_period on public.inv_movements(owner_id, store, year, month);

alter table public.inv_pos_sales enable row level security;
alter table public.inv_movements enable row level security;

drop policy if exists "inv_pos_owner" on public.inv_pos_sales;
create policy "inv_pos_owner" on public.inv_pos_sales for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());
drop policy if exists "inv_pos_admin" on public.inv_pos_sales;
create policy "inv_pos_admin" on public.inv_pos_sales for all using (public.is_admin());

drop policy if exists "inv_mov_owner" on public.inv_movements;
create policy "inv_mov_owner" on public.inv_movements for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());
drop policy if exists "inv_mov_admin" on public.inv_movements;
create policy "inv_mov_admin" on public.inv_movements for all using (public.is_admin());
