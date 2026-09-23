-- 153_ipos_sales_and_crm_import.sql
-- iPOS 門市業績匯入資料表與 CRM/iPOS 同步擴充

-- 1. iPOS 每日/商品銷售匯入主表 (ipos_daily_sales)
create table if not exists public.ipos_daily_sales (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  sales_date date not null,
  store text not null default '',
  revenue numeric not null default 0,
  order_count int not null default 0,
  cups_sold int not null default 0,
  product_name text not null default '',
  product_code text not null default '',
  category text not null default '',
  source text not null default 'ipos_upload', -- 'ipos_upload' | 'ipos_auto' | 'api'
  batch_id text not null default '',
  raw_data jsonb default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_id, store, sales_date, product_name)
);

create index if not exists idx_ipos_sales_owner_date on public.ipos_daily_sales(owner_id, sales_date, store);
create index if not exists idx_ipos_sales_product on public.ipos_daily_sales(owner_id, product_name);

alter table public.ipos_daily_sales enable row level security;
drop policy if exists ipos_daily_sales_admin on public.ipos_daily_sales;
create policy ipos_daily_sales_admin on public.ipos_daily_sales for all using (is_admin());
drop policy if exists ipos_daily_sales_owner on public.ipos_daily_sales;
create policy ipos_daily_sales_owner on public.ipos_daily_sales for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());

-- 2. iPOS 與 CRM 自動同步任務與日誌表 (為日後自動下載與 API 串接預留)
create table if not exists public.mkt_integration_sync_logs (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  system_type text not null default 'ipos', -- 'ipos' | 'crm'
  sync_type text not null default 'upload',  -- 'upload' | 'auto_fetch' | 'api_webhook'
  status text not null default 'success',   -- 'success' | 'failed' | 'processing'
  filename text not null default '',
  records_count int not null default 0,
  total_revenue numeric not null default 0,
  error_message text default '',
  meta jsonb default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_sync_logs_owner on public.mkt_integration_sync_logs(owner_id, system_type, created_at desc);

alter table public.mkt_integration_sync_logs enable row level security;
drop policy if exists sync_logs_admin on public.mkt_integration_sync_logs;
create policy sync_logs_admin on public.mkt_integration_sync_logs for all using (is_admin());
drop policy if exists sync_logs_owner on public.mkt_integration_sync_logs;
create policy sync_logs_owner on public.mkt_integration_sync_logs for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());
