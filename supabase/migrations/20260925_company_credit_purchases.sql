-- 公司錢包線上儲值訂單（ECPay）。ecpay-return 以 trade_no 找到 pending 訂單，
-- 標記 paid 後呼叫 add_company_credits 寫入公司錢包的儲值桶。
create table public.company_credit_purchases (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  purchased_by uuid not null references public.profiles(id),
  trade_no text not null unique,
  package_id text not null,
  usd_credit numeric not null check (usd_credit > 0),
  twd_amount numeric not null,
  status text not null default 'pending' check (status in ('pending','paid')),
  created_at timestamptz not null default now(),
  paid_at timestamptz
);

alter table public.company_credit_purchases enable row level security;

create policy "company_credit_purchases_select_own" on public.company_credit_purchases
  for select using (company_id = public.user_company_id());
create policy "company_credit_purchases_admin" on public.company_credit_purchases
  for all using (public.is_admin());
