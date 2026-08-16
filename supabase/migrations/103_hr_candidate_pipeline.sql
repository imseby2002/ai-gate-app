-- =============================================
-- AI GATE - Migration 103
-- 應徵流程（階段 5a）：擴充 agent_hr_candidates 供人事招募看板使用
-- 沿用既有 agent_hr_candidates（migration 079），新增招募流程所需欄位。
-- RLS 沿用 079：own(user_id = auth.uid()) + admin(is_admin())。
-- =============================================

alter table public.agent_hr_candidates
  add column if not exists store              text not null default '',   -- 應徵門市
  add column if not exists staff_category     text not null default '',   -- 錄取分類：fulltime(正職) | hourly(工讀)（空=未定）
  add column if not exists id_number          text not null default '',   -- 身分證字號
  add column if not exists birthday           date,                       -- 生日
  add column if not exists address            text not null default '',   -- 地址
  add column if not exists interview_at       timestamptz,                -- 面試時間
  add column if not exists hired_employee_id  uuid references public.hr_employees(id) on delete set null; -- 錄取後對應員工

alter table public.agent_hr_candidates
  drop constraint if exists agent_hr_candidates_staff_category_check;
alter table public.agent_hr_candidates
  add constraint agent_hr_candidates_staff_category_check
  check (staff_category in ('', 'fulltime', 'hourly'));
