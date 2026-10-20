-- =============================================
-- Migration: Fix company bnb_owner_id binding
-- Ensure companies (such as Im-tourist) do not have their bnb_owner_id bound to another company's owner/credentials
-- =============================================

-- 1. Ensure any company with an active owner member has bnb_owner_id pointing to its own owner if it was unset or pointing to a non-member
update public.companies c
set bnb_owner_id = coalesce(
  (
    select cm.member_id
    from public.company_members cm
    where cm.company_id = c.id and cm.role = 'owner' and cm.status = 'active'
    order by cm.created_at asc
    limit 1
  ),
  c.created_by
)
where c.bnb_owner_id is null
   or (c.name ilike '%im-tourist%' or c.name ilike '%im_tourist%' or c.name ilike '%tourist%')
   or not exists (
     select 1
     from public.company_members cm
     where cm.company_id = c.id
       and cm.member_id = c.bnb_owner_id
       and cm.status = 'active'
   );
