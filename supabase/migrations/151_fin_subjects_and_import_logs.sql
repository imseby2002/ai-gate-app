-- =============================================
-- AI GATE - Migration 151
-- 出納：建立科目主檔（fin_subjects）與匯入錯誤日誌（fin_import_logs）
-- 支援帳務小管家 Zero.Net 樹狀科目與詳細錯誤追蹤
-- =============================================

create table if not exists public.fin_subjects (
  id              uuid primary key default gen_random_uuid(),
  owner_id        uuid not null references public.profiles(id) on delete cascade,
  account_book    text not null default 'FT',
  class           text not null check (class in ('asset', 'liability', 'income', 'expense', 'equity', 'other')),
  parent_name     text not null default '',
  name            text not null,
  initial_balance numeric not null default 0,
  sort_order      int not null default 0,
  is_account      boolean not null default false,
  style           text not null default '常態性',
  zero_view       boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (owner_id, account_book, class, parent_name, name)
);

create index if not exists idx_fin_subjects_owner on public.fin_subjects(owner_id);
create index if not exists idx_fin_subjects_book on public.fin_subjects(owner_id, account_book);
create index if not exists idx_fin_subjects_class on public.fin_subjects(owner_id, class);

alter table public.fin_subjects enable row level security;

drop policy if exists "fin_subjects_owner" on public.fin_subjects;
create policy "fin_subjects_owner" on public.fin_subjects for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());

drop policy if exists "fin_subjects_admin" on public.fin_subjects;
create policy "fin_subjects_admin" on public.fin_subjects for all using (public.is_admin());

-- 匯入紀錄與錯誤明細日誌（以 JSONB 儲存詳細錯誤列、MAKE_NO、日期、原因、原始分錄）
create table if not exists public.fin_import_logs (
  id               uuid primary key default gen_random_uuid(),
  owner_id         uuid not null references public.profiles(id) on delete cascade,
  account_book     text not null default 'FT',
  filename         text not null default '',
  imported_at      timestamptz not null default now(),
  total_rows       int not null default 0,
  success_count    int not null default 0,
  error_count      int not null default 0,
  warning_count    int not null default 0,
  subjects_created int not null default 0,
  date_range       text not null default '',
  errors           jsonb not null default '[]'::jsonb
);

create index if not exists idx_fin_import_logs_owner on public.fin_import_logs(owner_id, imported_at desc);

alter table public.fin_import_logs enable row level security;

drop policy if exists "fin_import_logs_owner" on public.fin_import_logs;
create policy "fin_import_logs_owner" on public.fin_import_logs for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());

drop policy if exists "fin_import_logs_admin" on public.fin_import_logs;
create policy "fin_import_logs_admin" on public.fin_import_logs for all using (public.is_admin());
