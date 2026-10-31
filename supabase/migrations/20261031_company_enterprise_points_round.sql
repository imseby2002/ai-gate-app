-- 企業方案點數池改為整數：CORE 60、PRO 200、MAX 400（與 src/lib/company/enterprise-plans.ts 一致）
create or replace function public.company_monthly_gift(p_company_id uuid) returns numeric
language sql stable security definer set search_path to 'public' as $$
  select coalesce((
    select case s.enterprise_tier when 'core' then 60 when 'pro' then 200 when 'max' then 400 end
      from public.company_subscriptions s
     where s.company_id = p_company_id and s.enterprise
  ), 10)::numeric
$$;
revoke execute on function public.company_monthly_gift(uuid) from public, anon, authenticated;
