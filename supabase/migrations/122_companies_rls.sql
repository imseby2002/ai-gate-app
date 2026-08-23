-- 純量 helper，比照 is_admin() 的寫法（不是 accessible_owner_ids() 那種 SETOF——
-- 公司是一人一間，不需要多重成員切換）。
create or replace function public.user_company_id() returns uuid
  language sql stable security definer set search_path to 'public'
  as $$ select company_id from public.profiles where id = auth.uid() $$;

create or replace function public.user_company_role() returns text
  language sql stable security definer set search_path to 'public'
  as $$
    select role from public.company_members
    where member_id = auth.uid() and status = 'active'
    limit 1
  $$;

-- companies：同公司成員可讀；name/enabled_modules 等設定僅 owner/admin 角色可寫
create policy "companies_select_own" on public.companies
  for select using (id = public.user_company_id());

create policy "companies_update_owner_admin" on public.companies
  for update using (
    id = public.user_company_id() and public.user_company_role() in ('owner','admin')
  );

create policy "companies_admin" on public.companies
  for all using (public.is_admin());

-- company_members：同公司 active 成員可讀名冊；待接受邀請可被受邀信箱本人看到；
-- 新增/修改/刪除僅該公司 owner/admin 角色可做
create policy "company_members_select_same_company" on public.company_members
  for select using (
    company_id = public.user_company_id()
    or (member_id is null and lower(invited_email) = lower((auth.jwt() ->> 'email')))
  );

create policy "company_members_write_owner_admin" on public.company_members
  for insert with check (
    company_id = public.user_company_id() and public.user_company_role() in ('owner','admin')
  );

create policy "company_members_update_owner_admin" on public.company_members
  for update using (
    company_id = public.user_company_id() and public.user_company_role() in ('owner','admin')
  );

create policy "company_members_delete_owner_admin" on public.company_members
  for delete using (
    company_id = public.user_company_id() and public.user_company_role() in ('owner','admin')
  );

-- 受邀本人可以「接受」自己的邀請（把 member_id 從 null 填成自己），不需要先是 owner/admin
create policy "company_members_accept_own_invite" on public.company_members
  for update using (
    member_id is null and lower(invited_email) = lower((auth.jwt() ->> 'email'))
  );

create policy "company_members_admin" on public.company_members
  for all using (public.is_admin());
