-- 正職員工的期待休假日（排班參考）
create table if not exists public.shift_dayoff_requests (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null,
  employee_id uuid not null references public.hr_employees(id) on delete cascade,
  store text not null default '',
  off_date date not null,
  note text not null default '',
  created_at timestamptz not null default now(),
  unique (employee_id, off_date)
);
create index if not exists shift_dayoff_store_idx on public.shift_dayoff_requests (owner_id, store, off_date);
alter table public.shift_dayoff_requests enable row level security;
