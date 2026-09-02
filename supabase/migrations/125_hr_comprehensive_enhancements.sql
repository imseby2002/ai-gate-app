-- =============================================
-- AI GATE - Migration 125
-- 人事部門 7 大模組全面升級擴充：
-- 1. 應徵與入職 (Recruitment & Onboarding)
-- 2. 考勤與工時 (Attendance & Work Logs)
-- 3. 薪資計算與評分體系 (Payroll & Performance)
-- 4. 發薪與銀行串接 (Disbursement & TPBank & Pay Slip)
-- 5. 電子勞動合同管理 (Labor Contracts)
-- 6. 社會保險管理與合規通報 (Insurance & BHXH)
-- 7. 工會系統 (Công đoàn / Union)
-- =============================================

-- 1. hr_attendance 考勤審核與異常
alter table public.hr_attendance
  add column if not exists audit_log jsonb default '[]'::jsonb,
  add column if not exists anomaly_flags text[] default '{}',
  add column if not exists off_days int default 0,
  add column if not exists leave_days int default 0;

-- 2. hr_payroll 薪資詳細拆解、代扣與電子薪資條
alter table public.hr_payroll
  add column if not exists gross_salary numeric default 0,
  add column if not exists bhxh_amount numeric default 0,
  add column if not exists union_fee numeric default 0,
  add column if not exists pit_amount numeric default 0,
  add column if not exists advance_payment numeric default 0,
  add column if not exists audit_adjustment numeric default 0,
  add column if not exists payslip_token text,
  add column if not exists payslip_confirmed boolean default false,
  add column if not exists payslip_confirmed_at timestamptz;

create index if not exists idx_hr_payroll_token on public.hr_payroll(payslip_token);

-- 3. hr_contracts 勞動合同範本引擎與簽署閉環
alter table public.hr_contracts
  add column if not exists template_type text default 'one_year', -- seasonal | one_year | indefinite | probation
  add column if not exists variables jsonb default '{}'::jsonb,
  add column if not exists digital_signed boolean default false,
  add column if not exists paper_signed boolean default false,
  add column if not exists status text default 'active';

-- 4. 工會會員資料庫 (Quản lý Đoàn viên)
create table if not exists public.hr_union_members (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  employee_id uuid references public.hr_employees(id) on delete cascade,
  candidate_id uuid references public.agent_hr_candidates(id) on delete set null,
  full_name text not null default '',
  id_number text not null default '',
  bhxh_number text not null default '',
  store text not null default '',
  position text not null default '',
  join_date date,
  union_card_no text not null default '',
  status text not null default 'active', -- active | resigned
  application_doc_path text not null default '',
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_union_members_owner on public.hr_union_members(owner_id);

-- 5. 工會福利與慰問金申請 (Chế độ & Thăm hỏi)
create table if not exists public.hr_union_benefits (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  member_id uuid references public.hr_union_members(id) on delete cascade,
  benefit_type text not null default 'birthday', -- birthday | marriage | maternity | hospital | relief | other
  amount numeric not null default 0,
  request_date date not null default current_date,
  proof_doc_path text not null default '',
  status text not null default 'pending', -- pending | approved | rejected | disbursed
  approved_by text not null default '',
  disbursed_at timestamptz,
  notes text not null default '',
  created_at timestamptz not null default now()
);
create index if not exists idx_union_benefits_owner on public.hr_union_benefits(owner_id);

-- 6. 集體協議與勞資對話 (Thỏa ước lao động & Đối thoại)
create table if not exists public.hr_union_documents (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  doc_category text not null default 'tuldtt', -- tuldtt (集體協議) | noiquy (工作規章) | doitheo (勞資對話) | committee (執委會紀錄)
  title text not null default '',
  effective_date date,
  expiry_date date,
  storage_path text not null default '',
  file_name text not null default '',
  notes text not null default '',
  created_at timestamptz not null default now()
);
create index if not exists idx_union_documents_owner on public.hr_union_documents(owner_id);

-- 7. 工會財務收支管理 (Tài chính Công đoàn)
create table if not exists public.hr_union_finances (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  type text not null default 'income', -- income | expense
  category text not null default 'union_dues', -- union_dues | employer_contrib | welfare | activity | other
  amount numeric not null default 0,
  trans_date date not null default current_date,
  voucher_no text not null default '',
  proof_path text not null default '',
  description text not null default '',
  created_at timestamptz not null default now()
);
create index if not exists idx_union_finances_owner on public.hr_union_finances(owner_id);

-- RLS
alter table public.hr_union_members enable row level security;
alter table public.hr_union_benefits enable row level security;
alter table public.hr_union_documents enable row level security;
alter table public.hr_union_finances enable row level security;

create policy "hr_union_members_owner" on public.hr_union_members for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "hr_union_benefits_owner" on public.hr_union_benefits for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "hr_union_documents_owner" on public.hr_union_documents for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "hr_union_finances_owner" on public.hr_union_finances for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());
