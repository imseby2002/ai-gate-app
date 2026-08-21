-- =============================================
-- AI GATE - Migration 115
-- 出納・門市費用（階段 2）：每店每月費用（水電瓦斯冰塊…）。
-- 來源 import(人工匯入) / vendor(廠商填) / manual(手動)。每店每月每科目一筆。
-- =============================================

create table if not exists public.fin_bills (
  id            uuid primary key default gen_random_uuid(),
  owner_id      uuid not null references public.profiles(id) on delete cascade,
  store_code    text not null,
  year          int  not null,
  month         int  not null check (month between 1 and 12),
  category_code text not null,
  amount        numeric not null default 0,
  source        text not null default 'manual',  -- import | vendor | manual
  vendor_id     uuid,                             -- 階段 3 廠商填報用
  note          text not null default '',
  updated_at    timestamptz not null default now(),
  unique (owner_id, store_code, year, month, category_code)
);
create index if not exists idx_fin_bills_period on public.fin_bills(owner_id, year, month);

alter table public.fin_bills enable row level security;
drop policy if exists "fin_bills_owner" on public.fin_bills;
create policy "fin_bills_owner" on public.fin_bills for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());
drop policy if exists "fin_bills_admin" on public.fin_bills;
create policy "fin_bills_admin" on public.fin_bills for all using (public.is_admin());
