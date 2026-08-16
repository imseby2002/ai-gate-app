-- =============================================
-- AI GATE - Migration 108
-- 人員評估表（由管理／主管填寫）：評等 + 獎金 + 獎勵/懲罰明細項目。
-- 供薪資功能彙整（獎金 + 獎勵合計 − 懲罰合計）。
-- 每位員工每月一張（owner + employee + year + month 唯一）。
-- =============================================

create table if not exists public.hr_evaluations (
  id            uuid primary key default gen_random_uuid(),
  owner_id      uuid not null references public.profiles(id) on delete cascade,
  employee_id   uuid not null references public.hr_employees(id) on delete cascade,
  year          int  not null,
  month         int  not null check (month between 1 and 12),
  rating        text not null default '',            -- 評等（優/佳/普/待改進 或自訂）
  bonus         numeric not null default 0,          -- 獎金
  items         jsonb   not null default '[]'::jsonb, -- [{kind:'reward'|'penalty', label, amount}]
  reward_total  numeric not null default 0,          -- 獎勵合計（由 items 匯總）
  penalty_total numeric not null default 0,          -- 懲罰合計（由 items 匯總）
  notes         text not null default '',
  evaluator     text not null default '',            -- 填寫者
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (owner_id, employee_id, year, month)
);

create index if not exists idx_hr_evaluations_period
  on public.hr_evaluations(owner_id, year, month);

alter table public.hr_evaluations enable row level security;

drop policy if exists "hr_evaluations_owner" on public.hr_evaluations;
create policy "hr_evaluations_owner" on public.hr_evaluations
  for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());

drop policy if exists "hr_evaluations_admin" on public.hr_evaluations;
create policy "hr_evaluations_admin" on public.hr_evaluations
  for all using (public.is_admin());
