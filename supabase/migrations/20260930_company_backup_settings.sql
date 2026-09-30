-- =============================================
-- AI GATE - Migration 20260930 (company backup)
-- 依公司分檔備份：非企業版／MAX 公司的自動備份為付費加購，由管理者開關
-- =============================================

create table if not exists public.company_backup_settings (
  company_id uuid primary key references public.companies(id) on delete cascade,
  enabled boolean not null default false,
  updated_at timestamptz not null default now()
);
alter table public.company_backup_settings enable row level security;
