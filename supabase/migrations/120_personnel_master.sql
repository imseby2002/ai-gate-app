-- =============================================
-- AI GATE - Migration 120
-- 基本資料系統（人員模組 P1）：人員主檔補欄位＋勞動合同表。
-- 人員主檔沿用 agent_hr_candidates（apply_token 從應徵起一路一致）。
-- =============================================

-- 人員基本資料補欄位
alter table public.agent_hr_candidates
  add column if not exists native_place  text not null default '',  -- 籍貫
  add column if not exists gender         text not null default '',  -- 性別
  add column if not exists education      text not null default '',  -- 學歷
  add column if not exists company_email  text not null default '',  -- 公司 Email
  add column if not exists payroll_no     text not null default '',  -- 薪資編號
  add column if not exists profile_text   text not null default '',  -- AI 彙整之完整基本資料（P4）
  add column if not exists doc_reminder_at timestamptz;              -- 上次缺件週提醒（P3）

-- 勞動合同
create table if not exists public.hr_contracts (
  id            uuid primary key default gen_random_uuid(),
  owner_id      uuid not null references public.profiles(id) on delete cascade,
  candidate_id  uuid references public.agent_hr_candidates(id) on delete cascade,
  employee_id   uuid references public.hr_employees(id) on delete set null,
  contract_no   text not null default '',      -- 合同編號
  sign_date     date,                          -- 簽署日
  start_date    date,
  end_date      date,
  file_name     text not null default '',
  storage_path  text not null default '',      -- 簽署合同檔（hr-candidate-docs bucket）
  note          text not null default '',
  created_at    timestamptz not null default now()
);
create index if not exists idx_hr_contracts_owner on public.hr_contracts(owner_id);
create index if not exists idx_hr_contracts_candidate on public.hr_contracts(candidate_id);

alter table public.hr_contracts enable row level security;
drop policy if exists "hr_contracts_owner" on public.hr_contracts;
create policy "hr_contracts_owner" on public.hr_contracts for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());
drop policy if exists "hr_contracts_admin" on public.hr_contracts;
create policy "hr_contracts_admin" on public.hr_contracts for all using (public.is_admin());
