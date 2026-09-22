-- social_platform_credentials 與 marketing_campaigns 原本是 auth.uid()=user_id 的
-- self-only RLS，沒有跟上 040 migration 建立的 cs scope 協作 ACL（accessible_owner_ids/
-- settings_owner_ids）。這造成：即使應用層正確解析出「目前操作中的業務」owner_id，
-- 一般（RLS 受限）client 送出的查詢還是會被資料庫擋掉，協作者永遠只看得到自己的
-- （現在已搬空的）帳號，看起來像「設定不見了」。比照 cs_data_sources 的做法補上。
do $$
declare r record;
begin
  for r in select policyname, tablename from pg_policies
           where schemaname='public' and tablename in ('social_platform_credentials','marketing_campaigns')
  loop execute format('drop policy if exists %I on public.%I', r.policyname, r.tablename); end loop;

  execute 'create policy social_platform_credentials_acl_sel on public.social_platform_credentials for select to authenticated using (user_id in (select public.accessible_owner_ids(''cs'')))';
  execute 'create policy social_platform_credentials_acl_ins on public.social_platform_credentials for insert to authenticated with check (user_id in (select public.settings_owner_ids(''cs'')))';
  execute 'create policy social_platform_credentials_acl_upd on public.social_platform_credentials for update to authenticated using (user_id in (select public.settings_owner_ids(''cs''))) with check (user_id in (select public.settings_owner_ids(''cs'')))';
  execute 'create policy social_platform_credentials_acl_del on public.social_platform_credentials for delete to authenticated using (user_id in (select public.settings_owner_ids(''cs'')))';

  execute 'create policy marketing_campaigns_acl_sel on public.marketing_campaigns for select to authenticated using (user_id in (select public.accessible_owner_ids(''cs'')))';
  execute 'create policy marketing_campaigns_acl_ins on public.marketing_campaigns for insert to authenticated with check (user_id in (select public.settings_owner_ids(''cs'')))';
  execute 'create policy marketing_campaigns_acl_upd on public.marketing_campaigns for update to authenticated using (user_id in (select public.settings_owner_ids(''cs''))) with check (user_id in (select public.settings_owner_ids(''cs'')))';
  execute 'create policy marketing_campaigns_acl_del on public.marketing_campaigns for delete to authenticated using (user_id in (select public.settings_owner_ids(''cs'')))';
end $$;
