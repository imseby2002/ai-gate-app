-- 企業方案點數池：已指定等級（enterprise_tier）的企業版，改用公司錢包扣點，
-- 每月贈點 = 該級點數池（CORE 62、PRO 211、MAX 582，與 src/lib/company/enterprise-plans.ts 一致）；
-- 一般公司版仍為每月 10 點。未指定等級的舊企業版不經過錢包（維持不扣點）。

create or replace function public.company_monthly_gift(p_company_id uuid) returns numeric
language sql stable security definer set search_path to 'public' as $$
  select coalesce((
    select case s.enterprise_tier when 'core' then 62 when 'pro' then 211 when 'max' then 582 end
      from public.company_subscriptions s
     where s.company_id = p_company_id and s.enterprise
  ), 10)::numeric
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
    gift := public.company_monthly_gift(p_company_id);  -- 本月尚未開始使用，贈點視為完整
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
    update public.company_credit_wallets set gift_month = v_month, gift_remaining = public.company_monthly_gift(p_company_id), updated_at = now()
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

revoke execute on function public.company_monthly_gift(uuid) from public, anon, authenticated;
revoke execute on function public.get_company_credit_balance(uuid) from public, anon, authenticated;
revoke execute on function public.deduct_company_credits(uuid, uuid, numeric, text) from public, anon, authenticated;
