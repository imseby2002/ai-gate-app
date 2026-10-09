-- =============================================
-- AI GATE - Migration 20261006 (employee portal)
-- 員工專區 <公司子網域>/e/<打卡編號>：自設密碼與登入錯誤鎖定；僅 service_role 存取
-- =============================================

create table if not exists public.hr_employee_portal (
  employee_id uuid primary key references public.hr_employees(id) on delete cascade,
  pin_hash text,
  failed_count int not null default 0,
  locked_until timestamptz,
  updated_at timestamptz not null default now()
);
alter table public.hr_employee_portal enable row level security;
