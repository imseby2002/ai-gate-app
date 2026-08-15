-- HR 考勤：每門市每月匯入考勤機 .xls，彙總每人月時數；支援管理員手動補登時數。
create table if not exists public.hr_attendance (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  store text not null default '',            -- 門市（考勤檔的「部门」）
  year int not null,
  month int not null,
  attendance_no text not null default '',    -- 考勤機工号
  name text not null default '',
  att_type text not null default '',         -- 打卡计时(時薪) / 正常打卡(正職) 原文
  machine_hours numeric not null default 0,  -- 機器彙總：Σ 每日實際工作小時數
  work_days int not null default 0,          -- 有工時的天數
  adjust_hours numeric not null default 0,   -- 手動補登（忘打卡由管理簽單增補）
  adjust_note text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_id, year, month, store, attendance_no)
);
create index if not exists hr_attendance_owner_period_idx on public.hr_attendance (owner_id, year, month);
alter table public.hr_attendance enable row level security;

drop policy if exists "own hr_attendance" on public.hr_attendance;
create policy "own hr_attendance" on public.hr_attendance
  for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);
