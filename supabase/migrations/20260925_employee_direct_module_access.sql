-- 公司員工不再需要被 bnb_members「邀請」才能使用 CS/訂房：直接依
-- company_members 的職位（owner/admin/manager/viewer）授權，比照真正
-- 外部協作者用 bnb_members。accessible_owner_ids/settings_owner_ids
-- 是 CS/訂房相關資料表（cs_customers、cs_messages、marketing_campaigns…）
-- RLS 共用的授權清單，這裡把「本人所屬公司的業務帳號」直接併入清單，
-- 不必先在 bnb_members 補一筆才生效。

create or replace function public.accessible_owner_ids(p_scope text)
returns setof uuid
language sql
stable security definer
set search_path to 'public'
as $function$
  select auth.uid()
  union
  select owner_id from public.bnb_members
  where member_id = auth.uid() and status = 'active' and scope = p_scope
  union
  select coalesce(c.bnb_owner_id, owner_cm.member_id)
  from public.company_members cm
  join public.companies c on c.id = cm.company_id
  left join public.company_members owner_cm
    on owner_cm.company_id = cm.company_id and owner_cm.role = 'owner' and owner_cm.status = 'active'
  where cm.member_id = auth.uid() and cm.status = 'active'
    and coalesce(c.bnb_owner_id, owner_cm.member_id) is not null
$function$;

create or replace function public.settings_owner_ids(p_scope text)
returns setof uuid
language sql
stable security definer
set search_path to 'public'
as $function$
  select auth.uid()
  union
  select owner_id from public.bnb_members
  where member_id = auth.uid() and status = 'active' and scope = p_scope and role = 'admin'
  union
  select coalesce(c.bnb_owner_id, owner_cm.member_id)
  from public.company_members cm
  join public.companies c on c.id = cm.company_id
  left join public.company_members owner_cm
    on owner_cm.company_id = cm.company_id and owner_cm.role = 'owner' and owner_cm.status = 'active'
  where cm.member_id = auth.uid() and cm.status = 'active'
    and cm.role in ('owner', 'admin')
    and coalesce(c.bnb_owner_id, owner_cm.member_id) is not null
$function$;
