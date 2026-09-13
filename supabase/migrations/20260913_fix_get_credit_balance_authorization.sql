-- get_credit_balance 為 SECURITY DEFINER 且透過 PostgREST 公開 RPC，
-- 原本未檢查呼叫者身分，任何登入用戶皆可查詢任意 user_id 的餘額。
-- 修正：僅允許 service_role（後端）、本人、或 admin 查詢。
create or replace function public.get_credit_balance(p_user_id uuid) returns numeric
  language sql stable security definer set search_path to ''
as $$
  select coalesce(sum(amount_usd), 0)
  from public.credit_transactions
  where user_id = p_user_id
    and (auth.role() = 'service_role' or auth.uid() = p_user_id or public.is_admin())
$$;
