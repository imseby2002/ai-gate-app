-- 客戶系統改以「公司」為範圍：owner_id = 公司 owner 帳號（個人帳號＝自己）；
-- owner_id 為 null = 平台範圍（eSIM 商店客人，只有總管理員看得到）。
-- added_by：最先把這位客人帶進來的帳號；handled_by：該筆紀錄是哪個帳號服務的。

alter table public.crm_contacts alter column owner_id drop not null;
alter table public.crm_identities alter column owner_id drop not null;
alter table public.crm_activities alter column owner_id drop not null;

alter table public.crm_contacts add column if not exists added_by uuid references public.profiles(id) on delete set null;
alter table public.crm_activities add column if not exists handled_by uuid references public.profiles(id) on delete set null;
alter table public.crm_identities add column if not exists added_by uuid references public.profiles(id) on delete set null;

-- 平台範圍 owner_id 為 null，唯一鍵要把 null 視為相同值
alter table public.crm_identities drop constraint if exists crm_identities_owner_id_kind_value_key;
alter table public.crm_identities add constraint crm_identities_owner_id_kind_value_key unique nulls not distinct (owner_id, kind, value);
alter table public.crm_activities drop constraint if exists crm_activities_owner_id_source_source_id_key;
alter table public.crm_activities add constraint crm_activities_owner_id_source_source_id_key unique nulls not distinct (owner_id, source, source_id);

-- 既有資料：原本的 owner 就是帶入／服務的帳號
update public.crm_contacts set added_by = owner_id where added_by is null and owner_id is not null;
update public.crm_activities set handled_by = owner_id where handled_by is null and owner_id is not null and source <> 'manual';
update public.crm_identities set added_by = owner_id where added_by is null and owner_id is not null;

-- 既有 eSIM 客人移到平台範圍：先刪掉各管理員各自一份的 eSIM 紀錄與只有 eSIM 紀錄的客人，之後同步重建
delete from public.crm_activities where source = 'esim';
delete from public.crm_contacts c where not exists (select 1 from public.crm_activities a where a.contact_id = c.id)
  and c.added_by in (select id from public.profiles where user_type = 'admin');

-- 既有資料改歸到所屬公司的 owner
with m as (
  select p.id account, o.member_id company_owner
  from public.profiles p
  join public.company_members o on o.company_id = p.company_id and o.role = 'owner' and o.status = 'active'
  where o.member_id <> p.id
)
update public.crm_contacts c set owner_id = m.company_owner from m where c.owner_id = m.account;
with m as (
  select p.id account, o.member_id company_owner
  from public.profiles p
  join public.company_members o on o.company_id = p.company_id and o.role = 'owner' and o.status = 'active'
  where o.member_id <> p.id
)
update public.crm_identities i set owner_id = m.company_owner from m where i.owner_id = m.account;
with m as (
  select p.id account, o.member_id company_owner
  from public.profiles p
  join public.company_members o on o.company_id = p.company_id and o.role = 'owner' and o.status = 'active'
  where o.member_id <> p.id
)
update public.crm_activities a set owner_id = m.company_owner from m where a.owner_id = m.account;
