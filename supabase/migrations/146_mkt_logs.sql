-- =============================================
-- AI GATE - Migration 146
-- 行銷日誌：記錄所有員工與 AI 對談、行銷事件（活動、排程、內容、實體、外送、技能執行）及手動工作日誌。
-- =============================================

create table if not exists public.mkt_logs (
  id           uuid primary key default gen_random_uuid(),
  owner_id     uuid not null references public.profiles(id) on delete cascade,
  user_id      uuid references public.profiles(id) on delete set null,
  user_name    text not null default '',
  type         text not null default 'event', -- 'chat' (AI對談) | 'event' (行銷事件) | 'manual' (手動日誌) | 'summary' (AI彙整報告)
  category     text not null default 'general', -- 'campaign' | 'calendar' | 'content' | 'offline' | 'delivery' | 'skill' | 'ai_chat' | 'brand' | 'general'
  title        text not null default '',
  summary      text not null default '',
  details      jsonb not null default '{}'::jsonb,
  ref_id       text,
  credits      numeric(10,2) default 0,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists idx_mkt_logs_owner_date on public.mkt_logs(owner_id, created_at desc);
create index if not exists idx_mkt_logs_type on public.mkt_logs(owner_id, type);

alter table public.mkt_logs enable row level security;
drop policy if exists "mkt_logs_owner" on public.mkt_logs;
create policy "mkt_logs_owner" on public.mkt_logs for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());
drop policy if exists "mkt_logs_admin" on public.mkt_logs;
create policy "mkt_logs_admin" on public.mkt_logs for all using (public.is_admin());
