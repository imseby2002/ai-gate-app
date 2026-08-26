-- =============================================
-- AI GATE - Migration 124
-- 研發單位（Phase B）：研發討論AI——知識庫（可補充訓練資料）＋對話與訊息。
-- =============================================

-- 知識庫：配方／公司產品／外部相關產品／筆記，作為 AI 對話上下文
create table if not exists public.rd_knowledge (
  id         uuid primary key default gen_random_uuid(),
  owner_id   uuid not null references public.profiles(id) on delete cascade,
  kind       text not null default 'note',   -- recipe / product / external / note
  title      text not null default '',
  content    text not null default '',
  created_at timestamptz not null default now()
);
create index if not exists idx_rd_knowledge_owner on public.rd_knowledge(owner_id);

-- 對話
create table if not exists public.rd_chats (
  id         uuid primary key default gen_random_uuid(),
  owner_id   uuid not null references public.profiles(id) on delete cascade,
  title      text not null default '新對話',
  mode       text not null default 'discuss', -- discuss / guide
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_rd_chats_owner on public.rd_chats(owner_id, updated_at desc);

-- 訊息
create table if not exists public.rd_messages (
  id         uuid primary key default gen_random_uuid(),
  chat_id    uuid not null references public.rd_chats(id) on delete cascade,
  owner_id   uuid not null references public.profiles(id) on delete cascade,
  role       text not null,                   -- user / assistant
  content    text not null default '',
  suggestion text not null default '',         -- 建議答案（建議模式時）
  created_at timestamptz not null default now()
);
create index if not exists idx_rd_messages_chat on public.rd_messages(chat_id, created_at);

alter table public.rd_knowledge enable row level security;
alter table public.rd_chats enable row level security;
alter table public.rd_messages enable row level security;

drop policy if exists "rd_knowledge_owner" on public.rd_knowledge;
create policy "rd_knowledge_owner" on public.rd_knowledge for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());
drop policy if exists "rd_knowledge_admin" on public.rd_knowledge;
create policy "rd_knowledge_admin" on public.rd_knowledge for all using (public.is_admin());

drop policy if exists "rd_chats_owner" on public.rd_chats;
create policy "rd_chats_owner" on public.rd_chats for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());
drop policy if exists "rd_chats_admin" on public.rd_chats;
create policy "rd_chats_admin" on public.rd_chats for all using (public.is_admin());

drop policy if exists "rd_messages_owner" on public.rd_messages;
create policy "rd_messages_owner" on public.rd_messages for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());
drop policy if exists "rd_messages_admin" on public.rd_messages;
create policy "rd_messages_admin" on public.rd_messages for all using (public.is_admin());
