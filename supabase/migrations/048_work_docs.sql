-- 工作區（類 Notion）頁面：每位使用者多份文件，含區塊與時間限制，跨裝置同步
create table if not exists public.work_docs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  title text not null default '未命名頁面',
  blocks jsonb not null default '[]',
  deadline timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists work_docs_user_updated_idx
  on public.work_docs (user_id, updated_at desc);
alter table public.work_docs enable row level security;
drop policy if exists "own work_docs" on public.work_docs;
create policy "own work_docs" on public.work_docs
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Realtime 跨裝置同步
alter publication supabase_realtime add table public.work_docs;
