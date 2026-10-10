-- 點單機列印模式的訂單（不送 iPOS，客人拿單到櫃台結帳）
-- seq：每間門市每天從 1 開始的取餐號碼
create table if not exists public.ft_print_orders (
  id uuid primary key default gen_random_uuid(),
  store_no text not null,
  biz_date date not null,
  seq integer not null,
  device_key text not null,
  dine_option text not null,
  phone text,
  items jsonb not null,
  total numeric not null,
  created_at timestamptz not null default now(),
  unique (store_no, biz_date, seq)
);

alter table public.ft_print_orders enable row level security;
