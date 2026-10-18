-- 門市每小時業績（AI 排班建議用）：日期＋小時的單數、杯數、營收
create table if not exists public.store_hourly_sales (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null,
  store text not null,
  sale_date date not null,
  hour smallint not null check (hour >= 0 and hour <= 23),
  orders int not null default 0,
  cups numeric not null default 0,
  revenue numeric not null default 0,
  updated_at timestamptz not null default now(),
  unique (owner_id, store, sale_date, hour)
);
create index if not exists store_hourly_sales_idx on public.store_hourly_sales (owner_id, store, sale_date);
alter table public.store_hourly_sales enable row level security;
