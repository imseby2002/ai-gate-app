-- 行銷方案每月贈點（個人帳號）：FREE 1（需完成 Email 驗證）、CORE 10、PRO 20、MAX 35。
-- 當月用完即止、不累積到下個月；每月第一次查詢／扣點時重設（台北時間月份）。
-- 當月額度由應用端依方案傳入（lib/marketing/billing.ts 的 MONTHLY_GIFT_CREDITS），
-- 月中升級時補足差額。扣點順序：先扣本月贈點，再扣 credit_transactions 個人餘額。

create table public.marketing_gift_wallets (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  gift_month text,                                    -- 'YYYY-MM'，以下兩欄所屬月份
  gift_allowance numeric not null default 0 check (gift_allowance >= 0),  -- 本月已發放額度
  gift_remaining numeric not null default 0 check (gift_remaining >= 0),
  updated_at timestamptz not null default now()
);

create table public.marketing_gift_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  gift_month text not null,
  amount_usd numeric not null,                        -- 負值＝使用
  description text,
  created_at timestamptz not null default now()
);
create index marketing_gift_transactions_user_idx on public.marketing_gift_transactions (user_id, created_at desc);

alter table public.marketing_gift_wallets enable row level security;
alter table public.marketing_gift_transactions enable row level security;

create policy "marketing_gift_wallets_select_own" on public.marketing_gift_wallets
  for select using (user_id = auth.uid());
create policy "marketing_gift_wallets_admin" on public.marketing_gift_wallets
  for all using (public.is_admin());
create policy "marketing_gift_transactions_select_own" on public.marketing_gift_transactions
  for select using (user_id = auth.uid());
create policy "marketing_gift_transactions_admin" on public.marketing_gift_transactions
  for all using (public.is_admin());

-- 內部：依本月額度重設或補足（呼叫端已鎖定該列）
create or replace function public._sync_marketing_gift(p_user_id uuid, p_allowance numeric)
returns void
language plpgsql security definer set search_path to 'public' as $$
declare
  v_month text := to_char(now() at time zone 'Asia/Taipei', 'YYYY-MM');
begin
  update public.marketing_gift_wallets
    set gift_month = v_month, gift_allowance = p_allowance, gift_remaining = p_allowance, updated_at = now()
    where user_id = p_user_id and gift_month is distinct from v_month;
  -- 月中升級：補足差額（降級不收回）
  update public.marketing_gift_wallets
    set gift_remaining = gift_remaining + (p_allowance - gift_allowance), gift_allowance = p_allowance, updated_at = now()
    where user_id = p_user_id and gift_month = v_month and p_allowance > gift_allowance;
end $$;

-- 查詢本月剩餘贈點
create or replace function public.get_marketing_gift(p_user_id uuid, p_allowance numeric)
returns numeric
language plpgsql security definer set search_path to 'public' as $$
declare v_remaining numeric;
begin
  if p_allowance < 0 then raise exception 'INVALID_AMOUNT'; end if;
  insert into public.marketing_gift_wallets (user_id) values (p_user_id) on conflict (user_id) do nothing;
  perform 1 from public.marketing_gift_wallets where user_id = p_user_id for update;
  perform public._sync_marketing_gift(p_user_id, p_allowance);
  select gift_remaining into v_remaining from public.marketing_gift_wallets where user_id = p_user_id;
  return coalesce(v_remaining, 0);
end $$;

-- 原子扣贈點：最多扣 p_amount，回傳實際從贈點扣除的金額（其餘由呼叫端改扣個人餘額）
create or replace function public.consume_marketing_gift(
  p_user_id uuid, p_allowance numeric, p_amount numeric, p_description text
) returns numeric
language plpgsql security definer set search_path to 'public' as $$
declare
  v_month text := to_char(now() at time zone 'Asia/Taipei', 'YYYY-MM');
  v_remaining numeric;
  v_take numeric;
begin
  if p_amount < 0 or p_allowance < 0 then raise exception 'INVALID_AMOUNT'; end if;
  insert into public.marketing_gift_wallets (user_id) values (p_user_id) on conflict (user_id) do nothing;
  perform 1 from public.marketing_gift_wallets where user_id = p_user_id for update;
  perform public._sync_marketing_gift(p_user_id, p_allowance);

  select gift_remaining into v_remaining from public.marketing_gift_wallets where user_id = p_user_id;
  v_take := least(coalesce(v_remaining, 0), p_amount);
  if v_take > 0 then
    update public.marketing_gift_wallets set gift_remaining = gift_remaining - v_take, updated_at = now()
      where user_id = p_user_id;
    insert into public.marketing_gift_transactions (user_id, gift_month, amount_usd, description)
      values (p_user_id, v_month, -v_take, p_description);
  end if;
  return v_take;
end $$;

-- 僅供 service role 呼叫（應用端以 createAdminClient 執行）
revoke all on function public._sync_marketing_gift(uuid, numeric) from public, anon, authenticated;
revoke all on function public.get_marketing_gift(uuid, numeric) from public, anon, authenticated;
revoke all on function public.consume_marketing_gift(uuid, numeric, numeric, text) from public, anon, authenticated;
