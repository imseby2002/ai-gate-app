-- 員工專區臨時密碼：人事發給的密碼標記為臨時，員工登入後必須改成自己的密碼
alter table public.hr_employee_portal add column if not exists pin_temp boolean not null default false;
