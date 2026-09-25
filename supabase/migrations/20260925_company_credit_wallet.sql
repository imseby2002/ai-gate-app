-- 公司錢包：'company' 方案的公司成員使用扣點功能（行銷生成、智慧圓桌、AI Agent、專家技能…）時，
-- 改從公司錢包扣，不扣個人點數。錢包分兩個桶：
--   gift：每月贈點（$10），當月用完即止、不累積到下個月；每月第一次扣點時重設（台北時間月份）
--   paid：儲值／管理員加值，永久有效
-- 扣點順序：先扣 gift，再扣 paid。

create table public.company_credit_wallets (
  company_id uuid primary key references public.companies(id) on delete cascade,
  gift_month text,                                   -- 'YYYY-MM'，gift_remaining 所屬月份
  gift_remaining numeric not null default 0 check (gift_remaining >= 0),
  updated_at timestamptz not null default now()
);

create table public.company_credit_transactions (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete set null,   -- 使用者（扣點）或操作者（加值）
  bucket text not null check (bucket in ('gift','paid')),
  type text not null check (type in ('topup','usage','admin')),
  amount_usd numeric not null,
  description text,
  created_at timestamptz not null default now()
);
create index company_credit_transactions_company_idx on public.company_credit_transactions (company_id, created_at desc);

alter table public.company_credit_wallets enable row level security;
alter table public.company_credit_transactions enable row level security;

create policy "company_credit_wallets_select_own" on public.company_credit_wallets
  for select using (company_id = public.user_company_id());
create policy "company_credit_wallets_admin" on public.company_credit_wallets
  for all using (public.is_admin());
create policy "company_credit_transactions_select_own" on public.company_credit_transactions
  for select using (company_id = public.user_company_id());
create policy "company_credit_transactions_admin" on public.company_credit_transactions
  for all using (public.is_admin());

-- 公司方案是否有效（贈點只給有效的 'company' 方案）
create or replace function public.company_plan_active(p_company_id uuid) returns boolean
language sql stable security definer set search_path to 'public' as $$
  select exists (
    select 1 from public.company_subscriptions
    where company_id = p_company_id and plan = 'company' and status = 'active'
      and (current_period_end is null or current_period_end > now())
  )
$$;

-- 查詢餘額：本月可用贈點 + 儲值餘額
create or replace function public.get_company_credit_balance(p_company_id uuid)
returns table (gift numeric, paid numeric)
language plpgsql stable security definer set search_path to 'public' as $$
declare
  v_month text := to_char(now() at time zone 'Asia/Taipei', 'YYYY-MM');
  v_wallet public.company_credit_wallets%rowtype;
begin
  select * into v_wallet from public.company_credit_wallets where company_id = p_company_id;
  if not public.company_plan_active(p_company_id) then
    gift := 0;
  elsif v_wallet.company_id is null or v_wallet.gift_month is distinct from v_month then
    gift := 10;  -- 本月尚未開始使用，贈點視為完整（與 lib/company/pricing.ts 的 COMPANY_MONTHLY_GIFT_USD 一致）
  else
    gift := v_wallet.gift_remaining;
  end if;
  select coalesce(sum(amount_usd), 0) into paid
    from public.company_credit_transactions where company_id = p_company_id and bucket = 'paid';
  return next;
end $$;

-- 原子扣點：先扣贈點再扣儲值；不足時 raise INSUFFICIENT_CREDITS。回傳扣完後的總餘額。
create or replace function public.deduct_company_credits(
  p_company_id uuid, p_user_id uuid, p_amount numeric, p_description text
) returns numeric
language plpgsql security definer set search_path to 'public' as $$
declare
  v_month text := to_char(now() at time zone 'Asia/Taipei', 'YYYY-MM');
  v_gift numeric;
  v_paid numeric;
  v_from_gift numeric;
  v_from_paid numeric;
begin
  if p_amount < 0 then raise exception 'INVALID_AMOUNT'; end if;

  insert into public.company_credit_wallets (company_id) values (p_company_id) on conflict (company_id) do nothing;
  perform 1 from public.company_credit_wallets where company_id = p_company_id for update;

  -- 跨月（或首次）使用：重設本月贈點；方案無效時贈點歸零
  if not public.company_plan_active(p_company_id) then
    update public.company_credit_wallets set gift_month = v_month, gift_remaining = 0, updated_at = now()
      where company_id = p_company_id;
  else
    update public.company_credit_wallets set gift_month = v_month, gift_remaining = 10, updated_at = now()
      where company_id = p_company_id and gift_month is distinct from v_month;
  end if;

  select gift_remaining into v_gift from public.company_credit_wallets where company_id = p_company_id;
  select coalesce(sum(amount_usd), 0) into v_paid
    from public.company_credit_transactions where company_id = p_company_id and bucket = 'paid';

  v_from_gift := least(v_gift, p_amount);
  v_from_paid := p_amount - v_from_gift;
  if v_paid < v_from_paid then raise exception 'INSUFFICIENT_CREDITS'; end if;

  if v_from_gift > 0 then
    update public.company_credit_wallets set gift_remaining = gift_remaining - v_from_gift, updated_at = now()
      where company_id = p_company_id;
    insert into public.company_credit_transactions (company_id, user_id, bucket, type, amount_usd, description)
      values (p_company_id, p_user_id, 'gift', 'usage', -v_from_gift, p_description);
  end if;
  if v_from_paid > 0 then
    insert into public.company_credit_transactions (company_id, user_id, bucket, type, amount_usd, description)
      values (p_company_id, p_user_id, 'paid', 'usage', -v_from_paid, p_description);
  end if;

  return (v_gift - v_from_gift) + (v_paid - v_from_paid);
end $$;

-- 儲值／管理員加值（寫入 paid 桶）
create or replace function public.add_company_credits(
  p_company_id uuid, p_user_id uuid, p_amount numeric, p_type text, p_description text
) returns numeric
language plpgsql security definer set search_path to 'public' as $$
declare v_paid numeric;
begin
  if p_amount <= 0 then raise exception 'INVALID_AMOUNT'; end if;
  if p_type not in ('topup','admin') then raise exception 'INVALID_TYPE'; end if;
  insert into public.company_credit_transactions (company_id, user_id, bucket, type, amount_usd, description)
    values (p_company_id, p_user_id, 'paid', p_type, p_amount, p_description);
  select coalesce(sum(amount_usd), 0) into v_paid
    from public.company_credit_transactions where company_id = p_company_id and bucket = 'paid';
  return v_paid;
end $$;

-- 只允許伺服器端（service role）呼叫
revoke execute on function public.get_company_credit_balance(uuid) from public, anon, authenticated;
revoke execute on function public.deduct_company_credits(uuid, uuid, numeric, text) from public, anon, authenticated;
revoke execute on function public.add_company_credits(uuid, uuid, numeric, text, text) from public, anon, authenticated;
