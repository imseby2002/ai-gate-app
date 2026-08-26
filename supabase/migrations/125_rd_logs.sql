-- =============================================
-- AI GATE - Migration 125
-- 研發單位（Phase C）：研發討論AI 自動日誌（AI 摘要對話）。
-- =============================================
create table if not exists public.rd_logs (
  id         uuid primary key default gen_random_uuid(),
  owner_id   uuid not null references public.profiles(id) on delete cascade,
  chat_id    uuid not null references public.rd_chats(id) on delete cascade,
  title      text not null default '',
  summary    text not null default '',
  upto_count int not null default 0,          -- 已摘要到的訊息數（避免重複摘要）
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (chat_id)
);
create index if not exists idx_rd_logs_owner on public.rd_logs(owner_id, updated_at desc);

alter table public.rd_logs enable row level security;
drop policy if exists "rd_logs_owner" on public.rd_logs;
create policy "rd_logs_owner" on public.rd_logs for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());
drop policy if exists "rd_logs_admin" on public.rd_logs;
create policy "rd_logs_admin" on public.rd_logs for all using (public.is_admin());
