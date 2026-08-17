-- =============================================
-- AI GATE - Migration 111
-- 門市報表（階段 3）：標準價（GIÁ XUẤT CHUẨN）→ 差額換算金額損失。
-- =============================================

create table if not exists public.inv_material_prices (
  id             uuid primary key default gen_random_uuid(),
  owner_id       uuid not null references public.profiles(id) on delete cascade,
  material_code  text not null,
  material_name  text not null default '',
  unit           text not null default '',
  export_price   numeric not null default 0,   -- Đơn giá xuất CH（標準出庫單價）
  purchase_price numeric not null default 0,   -- Đơn giá nhập（進貨單價）
  updated_at     timestamptz not null default now(),
  unique (owner_id, material_code)
);
create index if not exists idx_inv_prices_owner on public.inv_material_prices(owner_id);

alter table public.inv_material_prices enable row level security;
drop policy if exists "inv_prices_owner" on public.inv_material_prices;
create policy "inv_prices_owner" on public.inv_material_prices for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());
drop policy if exists "inv_prices_admin" on public.inv_material_prices;
create policy "inv_prices_admin" on public.inv_material_prices for all using (public.is_admin());
