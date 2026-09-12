-- 公司方案自助升級的訂單表，比照 cs_plan_purchases／booking_plan_purchases
-- 的既有慣例（ecpay-return 用 trade_no 找到 pending 訂單並入帳）。
create table public.company_plan_purchases (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  purchased_by uuid not null references public.profiles(id),
  trade_no text not null unique,
  plan text not null check (plan in ('core','pro','max')),
  billing_cycle text not null default 'monthly',
  twd_amount numeric not null,
  status text not null default 'pending' check (status in ('pending','paid')),
  created_at timestamptz not null default now(),
  paid_at timestamptz
);

alter table public.company_plan_purchases enable row level security;

-- 同公司 owner/admin 角色可送出訂單、查詢自己公司的訂單紀錄
create policy "company_plan_purchases_select_own" on public.company_plan_purchases
  for select using (company_id = public.user_company_id());

create policy "company_plan_purchases_insert_owner_admin" on public.company_plan_purchases
  for insert with check (
    company_id = public.user_company_id()
    and public.user_company_role() in ('owner','admin')
    and purchased_by = auth.uid()
  );

create policy "company_plan_purchases_admin" on public.company_plan_purchases
  for all using (public.is_admin());
