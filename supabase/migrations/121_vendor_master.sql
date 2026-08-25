-- =============================================
-- AI GATE - Migration 121
-- 基本資料系統（廠商模組）：fin_vendors 補基本資料欄位＋採購紀錄表。
-- =============================================

alter table public.fin_vendors
  add column if not exists tax_id        text not null default '',   -- 統編
  add column if not exists address       text not null default '',
  add column if not exists phone         text not null default '',
  add column if not exists contact       text not null default '',   -- 聯絡人
  add column if not exists products       text not null default '',  -- 產品（自由文字）
  add column if not exists pay_terms     text not null default '',   -- postpaid 後付 / prepaid 預付
  add column if not exists billing_cycle text not null default '',   -- 結帳週期（月結／週結…）
  add column if not exists billing_day   int;                        -- 結帳日期 1-31

-- 採購紀錄
create table if not exists public.fin_vendor_purchases (
  id           uuid primary key default gen_random_uuid(),
  owner_id     uuid not null references public.profiles(id) on delete cascade,
  vendor_id    uuid not null references public.fin_vendors(id) on delete cascade,
  purchased_on date not null default current_date,
  product      text not null default '',
  qty          numeric not null default 0,
  amount       numeric not null default 0,
  note         text not null default '',
  created_at   timestamptz not null default now()
);
create index if not exists idx_fin_vendor_purchases on public.fin_vendor_purchases(owner_id, vendor_id, purchased_on);

alter table public.fin_vendor_purchases enable row level security;
drop policy if exists "fin_vendor_purchases_owner" on public.fin_vendor_purchases;
create policy "fin_vendor_purchases_owner" on public.fin_vendor_purchases for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());
drop policy if exists "fin_vendor_purchases_admin" on public.fin_vendor_purchases;
create policy "fin_vendor_purchases_admin" on public.fin_vendor_purchases for all using (public.is_admin());
