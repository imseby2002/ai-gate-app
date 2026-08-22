-- =============================================
-- AI GATE - Migration 117
-- 外務・證照合約管理（階段 1）：文件（租約/廠商合約/衛生證）、角色通知管道、提醒去重、私有 bucket。
-- =============================================

-- 文件主表：租約 lease / 廠商合約 contract / 衛生證 license / 其他 other
create table if not exists public.affair_documents (
  id                    uuid primary key default gen_random_uuid(),
  owner_id              uuid not null references public.profiles(id) on delete cascade,
  doc_type              text not null default 'other',   -- lease | contract | license | other
  title                 text not null default '',
  store_code            text not null default '',        -- 關聯 fin_stores.code；空＝公司級
  counterparty          text not null default '',         -- 房東 / 廠商 / 發證機關
  effective_date        date,                             -- 生效日
  expiry_date           date,                             -- 到期日
  payment_day           int,                              -- 每月繳費日 1-31（租約用）
  remind_days_before    int not null default 30,          -- 到期提前提醒天數
  pay_remind_days_before int not null default 5,          -- 繳費提前提醒天數
  status                text not null default 'active',   -- active | expired | archived
  file_name             text not null default '',
  storage_path          text not null default '',
  mime                  text not null default '',
  ai_extracted          jsonb,                            -- AI 辨識原始建議（階段 3）
  confirmed             boolean not null default false,   -- 人工是否已確認
  note                  text not null default '',
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);
create index if not exists idx_affair_docs_owner on public.affair_documents(owner_id);
create index if not exists idx_affair_docs_expiry on public.affair_documents(owner_id, expiry_date);

-- 角色通知管道（外務 external / 總務 general / 出納 cashier 各自 Telegram + Email）
create table if not exists public.affair_settings (
  owner_id                uuid primary key references public.profiles(id) on delete cascade,
  external_telegram       text not null default '',
  external_email          text not null default '',
  general_telegram        text not null default '',
  general_email           text not null default '',
  cashier_telegram        text not null default '',
  cashier_email           text not null default '',
  default_remind_days     int not null default 30,
  default_pay_remind_days int not null default 5,
  updated_at              timestamptz not null default now()
);

-- 提醒去重：每筆文件、每種提醒、每個到期日只發一次
create table if not exists public.affair_reminder_log (
  id           uuid primary key default gen_random_uuid(),
  owner_id     uuid not null references public.profiles(id) on delete cascade,
  document_id  uuid not null references public.affair_documents(id) on delete cascade,
  kind         text not null,           -- expiry | payment
  due_date     date not null,           -- 該次提醒對應的到期/繳費日
  sent_at      timestamptz not null default now(),
  unique (document_id, kind, due_date)
);
create index if not exists idx_affair_reminder_owner on public.affair_reminder_log(owner_id);

-- 私有儲存桶
insert into storage.buckets (id, name, public)
values ('affair-docs', 'affair-docs', false)
on conflict (id) do nothing;

-- RLS
alter table public.affair_documents enable row level security;
alter table public.affair_settings enable row level security;
alter table public.affair_reminder_log enable row level security;

drop policy if exists "affair_docs_owner" on public.affair_documents;
create policy "affair_docs_owner" on public.affair_documents for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());
drop policy if exists "affair_docs_admin" on public.affair_documents;
create policy "affair_docs_admin" on public.affair_documents for all using (public.is_admin());

drop policy if exists "affair_settings_owner" on public.affair_settings;
create policy "affair_settings_owner" on public.affair_settings for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());
drop policy if exists "affair_settings_admin" on public.affair_settings;
create policy "affair_settings_admin" on public.affair_settings for all using (public.is_admin());

drop policy if exists "affair_reminder_owner" on public.affair_reminder_log;
create policy "affair_reminder_owner" on public.affair_reminder_log for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());
drop policy if exists "affair_reminder_admin" on public.affair_reminder_log;
create policy "affair_reminder_admin" on public.affair_reminder_log for all using (public.is_admin());
