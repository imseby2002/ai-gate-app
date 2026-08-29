-- 排班結果（建議／確認後的實際班表）
create table if not exists shift_assignments (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null,
  period_id uuid not null references shift_periods(id) on delete cascade,
  employee_id uuid not null,
  work_date date not null,
  slot_code text not null,
  created_at timestamptz not null default now()
);
create unique index if not exists shift_assignments_uniq_idx on shift_assignments(period_id, employee_id, work_date, slot_code);
create index if not exists shift_assignments_period_idx on shift_assignments(owner_id, period_id);
alter table shift_assignments enable row level security;
create policy shift_assignments_admin on shift_assignments for all using (is_admin());
create policy shift_assignments_owner on shift_assignments for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());
