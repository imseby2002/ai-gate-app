-- HR：員工區分正職／工讀 + 保險管理
-- 正職(salaried)只看出勤是否正常、需即刻投保；
-- 工讀(hourly)需計算時數，且僅在月薪超過門檻(公司政策，預設 500 萬越盾)才需投保。

alter table public.hr_employees
  add column if not exists staff_category text not null default 'fulltime',   -- fulltime(正職) | hourly(工讀)
  add column if not exists insurance_required boolean not null default false,  -- 是否需投保（使用者確認）
  add column if not exists insurance_status text not null default 'none',      -- none | pending | enrolled
  add column if not exists insurance_number text not null default '',          -- 社保／保險編號
  add column if not exists insurance_salary numeric not null default 0;        -- 投保薪資（可與底薪不同）

alter table public.hr_employees drop constraint if exists hr_employees_staff_category_check;
alter table public.hr_employees add constraint hr_employees_staff_category_check
  check (staff_category in ('fulltime', 'hourly'));

alter table public.hr_employees drop constraint if exists hr_employees_insurance_status_check;
alter table public.hr_employees add constraint hr_employees_insurance_status_check
  check (insurance_status in ('none', 'pending', 'enrolled'));

-- 既有資料：把已標記 part-time / intern 者視為工讀，其餘視為正職
update public.hr_employees
  set staff_category = case when employment_type in ('part-time', 'intern') then 'hourly' else 'fulltime' end
  where staff_category = 'fulltime';

-- 公司層級保險政策（每 owner 一列）
create table if not exists public.hr_settings (
  owner_id uuid primary key references auth.users(id) on delete cascade,
  insurance_mode text not null default 'threshold',       -- all(全員投保) | threshold(超過門檻才投保)
  insurance_threshold numeric not null default 5000000,   -- 門檻金額
  insurance_currency text not null default 'VND',
  updated_at timestamptz not null default now(),
  constraint hr_settings_insurance_mode_check check (insurance_mode in ('all', 'threshold'))
);
alter table public.hr_settings enable row level security;

drop policy if exists "own hr_settings" on public.hr_settings;
create policy "own hr_settings" on public.hr_settings
  for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);
