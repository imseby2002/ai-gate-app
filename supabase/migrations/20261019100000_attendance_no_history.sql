alter table public.hr_employees add column if not exists prev_attendance_nos text[] not null default '{}';
comment on column public.hr_employees.prev_attendance_nos is '曾用過的打卡編號；舊的員工專區連結 /e/<舊編號> 會導向新編號';
