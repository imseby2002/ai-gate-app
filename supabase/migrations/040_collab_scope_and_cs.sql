-- 040: 協作 scope 化 + 訂房設定權分界 + CS 協作 ACL
-- 角色分級：viewer(唯讀) < manager(一般管理：營運可寫、設定不可) < admin(管理員：含設定+管協作者)
-- 模組分離：bnb_members.scope = 'booking' | 'cs'，可分別授權

-- 1) bnb_members 增加 scope（既有列預設 booking）
alter table public.bnb_members add column if not exists scope text not null default 'booking';
alter table public.bnb_members drop constraint if exists bnb_members_owner_id_invited_email_key;
create unique index if not exists bnb_members_owner_email_scope_uq
  on public.bnb_members(owner_id, invited_email, scope);

-- 2) scope-aware 授權函式
create or replace function public.accessible_owner_ids(p_scope text)
returns setof uuid language sql stable security definer set search_path=public as $fn$
  select auth.uid()
  union
  select owner_id from public.bnb_members
  where member_id = auth.uid() and status='active' and scope = p_scope
$fn$;

create or replace function public.writable_owner_ids(p_scope text)
returns setof uuid language sql stable security definer set search_path=public as $fn$
  select auth.uid()
  union
  select owner_id from public.bnb_members
  where member_id = auth.uid() and status='active' and scope = p_scope and role in ('admin','manager')
$fn$;

create or replace function public.settings_owner_ids(p_scope text)
returns setof uuid language sql stable security definer set search_path=public as $fn$
  select auth.uid()
  union
  select owner_id from public.bnb_members
  where member_id = auth.uid() and status='active' and scope = p_scope and role = 'admin'
$fn$;

-- 無參數版固定為 booking，向後相容既有營運表政策
create or replace function public.accessible_owner_ids()
returns setof uuid language sql stable security definer set search_path=public as $fn$
  select public.accessible_owner_ids('booking')
$fn$;

create or replace function public.writable_owner_ids()
returns setof uuid language sql stable security definer set search_path=public as $fn$
  select public.writable_owner_ids('booking')
$fn$;

-- 3) 訂房「設定類」表：寫入收歸管理員（一般管理不可改設定；讀取仍開放）
do $$
declare t text;
begin
  foreach t in array array['properties','pricing_rules','promo_codes','ical_settings','email_settings','email_templates','bnb_profiles']
  loop
    execute format('drop policy if exists %I on public.%I', t||'_acl_ins', t);
    execute format('drop policy if exists %I on public.%I', t||'_acl_upd', t);
    execute format('drop policy if exists %I on public.%I', t||'_acl_del', t);
    execute format('create policy %I on public.%I for insert to authenticated with check (user_id in (select public.settings_owner_ids(''booking'')))', t||'_acl_ins', t);
    execute format('create policy %I on public.%I for update to authenticated using (user_id in (select public.settings_owner_ids(''booking''))) with check (user_id in (select public.settings_owner_ids(''booking'')))', t||'_acl_upd', t);
    execute format('create policy %I on public.%I for delete to authenticated using (user_id in (select public.settings_owner_ids(''booking'')))', t||'_acl_del', t);
  end loop;
end $$;

-- 4) CS 表：以 scope='cs' 的協作 ACL 取代 self-only
do $$
declare r record; t text;
begin
  for r in select policyname, tablename from pg_policies
           where schemaname='public' and tablename in ('cs_customers','cs_messages','cs_tickets','cs_data_sources')
  loop execute format('drop policy if exists %I on public.%I', r.policyname, r.tablename); end loop;

  -- 對話類（manager 可寫）
  foreach t in array array['cs_customers','cs_messages','cs_tickets']
  loop
    execute format('create policy %I on public.%I for select to authenticated using (user_id in (select public.accessible_owner_ids(''cs'')))', t||'_acl_sel', t);
    execute format('create policy %I on public.%I for insert to authenticated with check (user_id in (select public.writable_owner_ids(''cs'')))', t||'_acl_ins', t);
    execute format('create policy %I on public.%I for update to authenticated using (user_id in (select public.writable_owner_ids(''cs''))) with check (user_id in (select public.writable_owner_ids(''cs'')))', t||'_acl_upd', t);
    execute format('create policy %I on public.%I for delete to authenticated using (user_id in (select public.writable_owner_ids(''cs'')))', t||'_acl_del', t);
  end loop;

  -- 知識庫（設定類，僅 cs-admin 可寫）
  execute 'create policy cs_data_sources_acl_sel on public.cs_data_sources for select to authenticated using (user_id in (select public.accessible_owner_ids(''cs'')))';
  execute 'create policy cs_data_sources_acl_ins on public.cs_data_sources for insert to authenticated with check (user_id in (select public.settings_owner_ids(''cs'')))';
  execute 'create policy cs_data_sources_acl_upd on public.cs_data_sources for update to authenticated using (user_id in (select public.settings_owner_ids(''cs''))) with check (user_id in (select public.settings_owner_ids(''cs'')))';
  execute 'create policy cs_data_sources_acl_del on public.cs_data_sources for delete to authenticated using (user_id in (select public.settings_owner_ids(''cs'')))';
end $$;
