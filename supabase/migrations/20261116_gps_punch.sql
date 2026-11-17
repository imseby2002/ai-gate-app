-- 手機 GPS 打卡：門市座標＋允許半徑，打卡紀錄（只收半徑內的打卡）
alter table pnl_stores add column if not exists geo_lat double precision;
alter table pnl_stores add column if not exists geo_lng double precision;
alter table pnl_stores add column if not exists geo_radius_m integer not null default 150;

create table if not exists hr_punches (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null,
  employee_id uuid not null,
  attendance_no text not null default '',
  store text not null,
  work_date date not null,           -- 越南時間日期
  kind text not null check (kind in ('in', 'out')),
  punched_at timestamptz not null default now(),
  lat double precision,
  lng double precision,
  accuracy_m double precision,
  distance_m double precision,
  created_at timestamptz not null default now()
);
create index if not exists hr_punches_emp_idx on hr_punches(owner_id, employee_id, work_date);
create index if not exists hr_punches_store_idx on hr_punches(owner_id, store, work_date);
alter table hr_punches enable row level security;
create policy hr_punches_admin on hr_punches for all using (is_admin());
create policy hr_punches_owner on hr_punches for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());
