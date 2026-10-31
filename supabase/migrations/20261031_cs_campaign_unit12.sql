-- 客服 webhook 每則訊息都要讀行銷活動的客服設定（unit_data 的第 12 單元），
-- 原本整包 unit_data 都讀（單一用戶可達 170KB/次），改由函式只回傳第 12 單元以降低流量
create or replace function public.cs_campaign_unit12(p_user_id uuid)
returns table (unit12 jsonb, updated_at timestamptz)
language sql
stable
security definer
set search_path = public
as $$
  select c.unit_data -> '12', c.updated_at
  from public.marketing_campaigns c
  where c.user_id = p_user_id and c.status <> 'archived'
  order by c.updated_at desc
  limit 10;
$$;

revoke all on function public.cs_campaign_unit12(uuid) from public, anon, authenticated;
grant execute on function public.cs_campaign_unit12(uuid) to service_role;
