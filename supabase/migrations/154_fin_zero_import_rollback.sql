-- =============================================
-- AI GATE - Migration 154
-- 出納・MDB 匯入批次追蹤與防呆撤回/覆蓋支援
-- =============================================

-- 1. hr_cashflow 增加匯入批次關聯與索引
alter table public.hr_cashflow
  add column if not exists import_batch_id uuid references public.fin_import_logs(id) on delete set null;

create index if not exists idx_hr_cashflow_import_batch
  on public.hr_cashflow(owner_id, import_batch_id);

create index if not exists idx_hr_cashflow_source
  on public.hr_cashflow(owner_id, source);

-- 2. fin_import_logs 增加批次狀態與撤回時間
alter table public.fin_import_logs
  add column if not exists status text not null default 'active', -- 'active' | 'reverted'
  add column if not exists reverted_at timestamptz;
