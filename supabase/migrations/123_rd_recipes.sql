-- =============================================
-- AI GATE - Migration 123
-- 研發單位（Phase A）：研發配方成本表。
-- 來源：配方表.xlsx「Bảng tính giá vốn SP đồ uống」sheet（多區塊成本試算）。
-- =============================================

create table if not exists public.rd_recipes (
  id                 uuid primary key default gen_random_uuid(),
  owner_id           uuid not null references public.profiles(id) on delete cascade,
  name               text not null,
  category           text not null default '',       -- 分類（杯型／飲品群，可空）
  cup_size           text not null default '',        -- 杯型（如 CỐC 350 CC）
  total_export       numeric not null default 0,       -- 合計（售價/出價 TTX）
  total_purchase     numeric not null default 0,       -- 合計（成本/進價 TTN）
  unit_cost_export   numeric not null default 0,       -- 單位成本（Giá 1kg/1000cc 出價）
  unit_cost_purchase numeric not null default 0,       -- 單位成本（進價）
  unit_label         text not null default '',         -- 單位成本基準（1kg／1000cc）
  note               text not null default '',
  source             text not null default 'manual',   -- manual / import
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  unique (owner_id, name)
);
create index if not exists idx_rd_recipes_owner on public.rd_recipes(owner_id);

create table if not exists public.rd_recipe_items (
  id              uuid primary key default gen_random_uuid(),
  recipe_id       uuid not null references public.rd_recipes(id) on delete cascade,
  owner_id        uuid not null references public.profiles(id) on delete cascade,
  sort            int not null default 0,
  material_name   text not null default '',
  unit            text not null default '',            -- ĐVT
  qty             numeric not null default 0,           -- Lượng
  price_export    numeric not null default 0,           -- ĐGX 出價
  price_purchase  numeric not null default 0,           -- ĐGN 進價
  amount_export   numeric not null default 0,           -- TTX
  amount_purchase numeric not null default 0            -- TTN
);
create index if not exists idx_rd_recipe_items on public.rd_recipe_items(recipe_id);

alter table public.rd_recipes enable row level security;
alter table public.rd_recipe_items enable row level security;

drop policy if exists "rd_recipes_owner" on public.rd_recipes;
create policy "rd_recipes_owner" on public.rd_recipes for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());
drop policy if exists "rd_recipes_admin" on public.rd_recipes;
create policy "rd_recipes_admin" on public.rd_recipes for all using (public.is_admin());

drop policy if exists "rd_recipe_items_owner" on public.rd_recipe_items;
create policy "rd_recipe_items_owner" on public.rd_recipe_items for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());
drop policy if exists "rd_recipe_items_admin" on public.rd_recipe_items;
create policy "rd_recipe_items_admin" on public.rd_recipe_items for all using (public.is_admin());
