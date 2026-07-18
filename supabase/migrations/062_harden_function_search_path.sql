-- 硬化：釘死函式的 search_path，消除 Supabase linter 的
-- function_search_path_mutable 警告（避免 search_path 注入）。
--
-- 這 11 個函式內部所有資料表引用皆已 public. 完整限定，
-- auth.uid()/auth.jwt() 也已限定 schema，now() 來自 pg_catalog（永遠在路徑中），
-- 因此設為空 search_path 不改變任何行為，純安全硬化。

ALTER FUNCTION public.claim_work_invitations()                 SET search_path = '';
ALTER FUNCTION public.get_credit_balance(uuid)                 SET search_path = '';
ALTER FUNCTION public.get_usage_summary(uuid, integer)         SET search_path = '';
ALTER FUNCTION public.is_admin()                               SET search_path = '';
ALTER FUNCTION public.is_work_item_member(uuid)                SET search_path = '';
ALTER FUNCTION public.is_work_member(uuid)                     SET search_path = '';
ALTER FUNCTION public.work_parent_owned(uuid)                  SET search_path = '';
ALTER FUNCTION public.update_updated_at()                      SET search_path = '';
ALTER FUNCTION public.update_company_data_updated_at()         SET search_path = '';
ALTER FUNCTION public.update_marketing_campaign_updated_at()   SET search_path = '';
ALTER FUNCTION public.update_social_credentials_updated_at()   SET search_path = '';
ALTER FUNCTION public.bump_pos_menu_revision(uuid)             SET search_path = '';
