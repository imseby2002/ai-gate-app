-- 員工隸屬單位（可多個）與門市鎖定；系統帳號（profile_id）的單位與門市權限以人事資料為準
alter table public.hr_employees
  add column if not exists units text[] not null default '{}',
  add column if not exists store_locked boolean not null default true;

create index if not exists hr_employees_profile_id_idx on public.hr_employees (profile_id) where profile_id is not null;
