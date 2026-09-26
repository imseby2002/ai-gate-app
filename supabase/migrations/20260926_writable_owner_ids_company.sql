-- 20260925_employee_direct_module_access 只把 company_members 併入
-- accessible_owner_ids/settings_owner_ids，漏了 writable_owner_ids：公司員工
-- 看得到訂房資料卻寫不進去，每日入住當天第一次開啟時自動建立房間列被 RLS
-- 擋掉，整天顯示「尚無資料」、所有訂單都變成未對應。比照 bnb_members，
-- owner/admin/manager 可寫。

create or replace function public.writable_owner_ids(p_scope text)
returns setof uuid
language sql
stable security definer
set search_path to 'public'
as $function$
  select auth.uid()
  union
  select owner_id from public.bnb_members
  where member_id = auth.uid() and status = 'active' and scope = p_scope and role in ('admin', 'manager')
  union
  select coalesce(c.bnb_owner_id, owner_cm.member_id)
  from public.company_members cm
  join public.companies c on c.id = cm.company_id
  left join public.company_members owner_cm
    on owner_cm.company_id = cm.company_id and owner_cm.role = 'owner' and owner_cm.status = 'active'
  where cm.member_id = auth.uid() and cm.status = 'active'
    and cm.role in ('owner', 'admin', 'manager')
    and coalesce(c.bnb_owner_id, owner_cm.member_id) is not null
$function$;
