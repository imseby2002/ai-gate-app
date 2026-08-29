-- 門市排班：排班期、員工可上班時段（token 免登入填報）、彙整。
create table if not exists shift_periods (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null,
  store text not null,
  title text not null default '',
  start_date date not null,
  end_date date not null,
  slots jsonb not null default '[]'::jsonb,   -- [{code,label}]
  status text not null default 'collecting',  -- collecting | suggested | confirmed
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists shift_periods_owner_store_idx on shift_periods(owner_id, store, start_date);
alter table shift_periods enable row level security;
create policy shift_periods_admin on shift_periods for all using (is_admin());
create policy shift_periods_owner on shift_periods for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());

-- 每位員工於某排班期的專屬填報連結
create table if not exists shift_tokens (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null,
  period_id uuid not null references shift_periods(id) on delete cascade,
  employee_id uuid not null,
  employee_name text not null default '',
  token text not null unique,
  submitted_at timestamptz,
  created_at timestamptz not null default now()
);
create unique index if not exists shift_tokens_period_emp_idx on shift_tokens(period_id, employee_id);
alter table shift_tokens enable row level security;
create policy shift_tokens_admin on shift_tokens for all using (is_admin());
create policy shift_tokens_owner on shift_tokens for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());

-- 員工勾選的可上班（日期×時段），有列＝可上班
create table if not exists shift_availability (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null,
  period_id uuid not null references shift_periods(id) on delete cascade,
  employee_id uuid not null,
  work_date date not null,
  slot_code text not null,
  created_at timestamptz not null default now()
);
create unique index if not exists shift_availability_uniq_idx on shift_availability(period_id, employee_id, work_date, slot_code);
create index if not exists shift_availability_period_idx on shift_availability(owner_id, period_id);
alter table shift_availability enable row level security;
create policy shift_availability_admin on shift_availability for all using (is_admin());
create policy shift_availability_owner on shift_availability for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());
