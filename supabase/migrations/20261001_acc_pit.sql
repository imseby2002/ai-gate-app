-- 會計：個人所得稅（越南 Thuế TNCN，薪資所得）
--  - hr_employees 補稅籍/身分欄位（MST、生日、地址、CCCD 核發日/地）
--  - hr_tax_dependents：扶養人（Người phụ thuộc），依員工登記，供計算家庭扣除
--  - acc_pit_settings：每家公司稅率參數（預設 2026：Luật 109/2025/QH15 五級累進、NQ 110/2025/UBTVQH15 扣除額）
--  - acc_pit_monthly：每月每人試算/申報結果，年度彙總供 quyết toán

alter table public.hr_employees
  add column if not exists tax_code text not null default '',
  add column if not exists birthday date,
  add column if not exists address text not null default '',
  add column if not exists address_new text not null default '',
  add column if not exists id_issue_date date,
  add column if not exists id_issue_place text not null default '';

create table if not exists public.hr_tax_dependents (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  employee_id uuid not null references public.hr_employees(id) on delete cascade,
  name text not null,
  relationship text not null default '',
  id_number text not null default '',   -- 身分識別碼（CCCD / Mã định danh）
  tax_code text not null default '',
  birthday date,
  from_month text not null default '',  -- 開始扣除 YYYY-MM（空＝不限）
  to_month text not null default '',    -- 結束扣除 YYYY-MM（空＝不限）
  registered boolean not null default false, -- 已向稅局登記 NPT
  note text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists hr_tax_dependents_emp_idx on public.hr_tax_dependents(employee_id);
create index if not exists hr_tax_dependents_owner_idx on public.hr_tax_dependents(owner_id);
alter table public.hr_tax_dependents enable row level security;
drop policy if exists "own hr_tax_dependents" on public.hr_tax_dependents;
create policy "own hr_tax_dependents" on public.hr_tax_dependents
  for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

create table if not exists public.acc_pit_settings (
  owner_id uuid primary key references auth.users(id) on delete cascade,
  personal_deduction numeric not null default 15500000,
  dependent_deduction numeric not null default 6200000,
  -- [{ upTo: number|null, rate: number }]，upTo 為每月應稅所得級距上限（VND）
  brackets jsonb not null default '[{"upTo":10000000,"rate":0.05},{"upTo":30000000,"rate":0.10},{"upTo":60000000,"rate":0.20},{"upTo":100000000,"rate":0.30},{"upTo":null,"rate":0.35}]',
  insurance_rate numeric not null default 0.105,   -- 員工自付 BHXH 8% + BHYT 1.5% + BHTN 1%
  casual_rate numeric not null default 0.10,       -- 無勞動合約/未滿 3 個月：就源扣繳 10%
  casual_threshold numeric not null default 5000000, -- 每次給付達此金額才扣（NĐ 253/2026，2026-07-01 起）
  updated_at timestamptz not null default now()
);
alter table public.acc_pit_settings enable row level security;
drop policy if exists "own acc_pit_settings" on public.acc_pit_settings;
create policy "own acc_pit_settings" on public.acc_pit_settings
  for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

create table if not exists public.acc_pit_monthly (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  employee_id uuid not null references public.hr_employees(id) on delete cascade,
  year int not null,
  month int not null check (month between 1 and 12),
  method text not null default 'progressive' check (method in ('progressive','flat10','none')),
  gross_income numeric not null default 0,      -- 應稅總所得（薪＋津貼＋獎金）
  exempt_income numeric not null default 0,     -- 免稅所得（如餐費、加班溢價部分等）
  insurance_deduction numeric not null default 0,
  dependents int not null default 0,
  personal_deduction numeric not null default 0,
  dependent_deduction numeric not null default 0,
  taxable_income numeric not null default 0,
  tax_amount numeric not null default 0,
  note text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (employee_id, year, month)
);
create index if not exists acc_pit_monthly_owner_idx on public.acc_pit_monthly(owner_id, year, month);
alter table public.acc_pit_monthly enable row level security;
drop policy if exists "own acc_pit_monthly" on public.acc_pit_monthly;
create policy "own acc_pit_monthly" on public.acc_pit_monthly
  for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

-- 員工個人稅計算方式：''＝依正兼職自動（正職→累進、兼職→10% 就源）
alter table public.hr_employees add column if not exists pit_method text not null default '' check (pit_method in ('','progressive','flat10','none'));
