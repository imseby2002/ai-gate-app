-- 帳號可管理多間門市（profiles.store_codes；department 保留為目前門市）；人事資料記錄管理的門市
alter table public.profiles add column if not exists store_codes text[] not null default '{}';
alter table public.hr_employees add column if not exists managed_stores text[] not null default '{}';
