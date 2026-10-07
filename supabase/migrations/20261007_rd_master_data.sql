-- =============================================
-- AI GATE - Migration 20261007 (rd master data)
-- 匯入「GIÁ THÀNH」成本總表所需欄位：
--  1. 原料定價：三層價（補上 124 的 dealer_price／category）＋資料來源
--  2. 配方：種類（飲品／咖啡／餐點／半成品）、杯型、售價成本比、Excel 合計快照
--  3. 配方明細：原始用量與單位（qty_per_cup 為換算成定價單位後的用量）
--  4. 產品售價與成本比例表（含加料組合）
-- =============================================

alter table public.inv_material_prices
  add column if not exists dealer_price numeric not null default 0,       -- xuất đại lý（經銷／非直營門市價）
  add column if not exists category text not null default '原料',          -- 原料 / 半成品 / 耗材 / 道具 / 設備
  add column if not exists source text not null default '';               -- 匯入來源（工作表名）

create index if not exists idx_inv_prices_category on public.inv_material_prices(owner_id, category);

alter table public.inv_recipes
  add column if not exists kind text not null default '',                 -- drink / coffee / food / base
  add column if not exists cup_size text not null default '',             -- 杯型（Cốc 500cc）
  add column if not exists unit_label text not null default '',           -- 半成品單位成本基準（Giá 1kg…）
  add column if not exists sell_ratio_export numeric,                     -- Phần trăm giá bán（出價成本／售價）
  add column if not exists sell_ratio_purchase numeric,                   -- 同上（進價）
  add column if not exists excel_total_export numeric,                    -- Excel 合計 TTX 快照
  add column if not exists excel_total_purchase numeric,                  -- Excel 合計 TTN 快照
  add column if not exists source text not null default 'manual';

create index if not exists idx_inv_recipes_kind on public.inv_recipes(owner_id, kind);

alter table public.inv_recipe_items
  add column if not exists qty_display numeric,                           -- 原始用量（如 250）
  add column if not exists unit_display text not null default '';         -- 原始單位（如 g）

create table if not exists public.rd_product_prices (
  id             uuid primary key default gen_random_uuid(),
  owner_id       uuid not null references public.profiles(id) on delete cascade,
  sheet          text not null default '',          -- white_pearl（TOPPING 用白珍珠）/ combos（各種加料組合）
  sort           int not null default 0,
  group_name     text not null default '',          -- Nhóm（茶類群組）
  product_name   text not null,                     -- 產品（含加料描述）
  topping        text not null default '',          -- 加料（0 top / 1 top…）
  topping_price  numeric,                           -- 加料價
  price_s        numeric,
  price_m        numeric,
  price_l        numeric,
  cost_ratio_s   numeric,                           -- 成本比例（Giá vốn）
  cost_ratio_m   numeric,
  cost_ratio_l   numeric,
  cost_ratio2_s  numeric,                           -- 第二組成本比例（成本 S/M/L 欄）
  cost_ratio2_m  numeric,
  cost_ratio2_l  numeric,
  created_at     timestamptz not null default now()
);

create index if not exists idx_rd_product_prices_owner on public.rd_product_prices(owner_id, sheet, sort);

alter table public.rd_product_prices enable row level security;
drop policy if exists "rd_product_prices_owner" on public.rd_product_prices;
create policy "rd_product_prices_owner" on public.rd_product_prices for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());
drop policy if exists "rd_product_prices_admin" on public.rd_product_prices;
create policy "rd_product_prices_admin" on public.rd_product_prices for all using (public.is_admin());

-- 配方明細排序（uuid 主鍵無法保留原始順序）
alter table inv_recipe_items add column if not exists sort int default 0;
