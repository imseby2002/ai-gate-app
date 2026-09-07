-- =============================================
-- AI GATE - Migration 124
-- 原料、設備、道具、耗材 三層定價體系：
-- 1. purchase_price: 工廠進貨價 (Factory Cost)
-- 2. export_price: 賣給直營門市價格 (Direct Store Price，配方表使用此價格為門市成本)
-- 3. dealer_price: 賣給經銷商或非直營門市價格 (Distributor / Franchise Price)
-- 4. category: 品項分類（原料 / 設備 / 道具 / 耗材）
-- =============================================

alter table public.inv_material_prices
  add column if not exists dealer_price numeric not null default 0,
  add column if not exists category text not null default '原料';

create index if not exists idx_inv_prices_category on public.inv_material_prices(owner_id, category);
