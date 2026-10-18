-- 時間制排班：員工可上班規則、門市人力需求、正式班表（分鐘為單位，0~1440）
create table if not exists public.shift_avail_rules (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null,
  employee_id uuid not null references public.hr_employees(id) on delete cascade,
  store text not null,
  start_date date not null,
  end_date date not null,
  weekdays smallint[] not null default '{}', -- 0=週日…6=週六；空＝每天
  start_min int not null check (start_min >= 0 and start_min < 1440),
  end_min int not null check (end_min > start_min and end_min <= 1440),
  note text not null default '',
  created_at timestamptz not null default now(),
  check (end_date >= start_date)
);
create index if not exists shift_avail_rules_store_idx on public.shift_avail_rules (owner_id, store, end_date);
create index if not exists shift_avail_rules_emp_idx on public.shift_avail_rules (employee_id, end_date);
alter table public.shift_avail_rules enable row level security;

create table if not exists public.shift_needs (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null,
  store text not null,
  weekdays smallint[] not null default '{}', -- 空＝每天
  start_min int not null check (start_min >= 0 and start_min < 1440),
  end_min int not null check (end_min > start_min and end_min <= 1440),
  headcount int not null check (headcount >= 0),
  created_at timestamptz not null default now()
);
create index if not exists shift_needs_store_idx on public.shift_needs (owner_id, store);
alter table public.shift_needs enable row level security;

create table if not exists public.shift_plans (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null,
  store text not null,
  employee_id uuid not null references public.hr_employees(id) on delete cascade,
  work_date date not null,
  start_min int not null check (start_min >= 0 and start_min < 1440),
  end_min int not null check (end_min > start_min and end_min <= 1440),
  status text not null default 'draft' check (status in ('draft','published')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists shift_plans_store_idx on public.shift_plans (owner_id, store, work_date);
create index if not exists shift_plans_emp_idx on public.shift_plans (employee_id, work_date);
alter table public.shift_plans enable row level security;
