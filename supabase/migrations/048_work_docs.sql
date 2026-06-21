-- 工作項目：每位使用者多筆工作項目，deadline 可選，跨裝置同步
create table if not exists public.work_docs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  title text not null default '未命名項目',
  notes text not null default '',
  status text not null default '',
  done boolean not null default false,
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

-- ── 協作（沿用訂房協作模式：邀請不寄信、同 email 登入自動 claim）──
create table if not exists public.work_members (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  invited_email text not null,
  member_id uuid references public.profiles(id) on delete cascade,
  status text not null default 'pending', -- pending | active
  created_at timestamptz not null default now(),
  unique (owner_id, invited_email)
);
alter table public.work_members enable row level security;

drop policy if exists "work_members owner" on public.work_members;
create policy "work_members owner" on public.work_members
  for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

drop policy if exists "work_members self read" on public.work_members;
create policy "work_members self read" on public.work_members
  for select using (
    auth.uid() = member_id
    or lower(invited_email) = lower((auth.jwt() ->> 'email'))
  );

create or replace function public.is_work_member(p_owner uuid)
returns boolean language sql security definer stable as $$
  select exists (
    select 1 from public.work_members
    where owner_id = p_owner and member_id = auth.uid() and status = 'active'
  );
$$;

create or replace function public.claim_work_invitations()
returns void language plpgsql security definer as $$
begin
  update public.work_members
  set member_id = auth.uid(), status = 'active'
  where member_id is null
    and lower(invited_email) = lower((auth.jwt() ->> 'email'));
end;
$$;

-- work_docs 開放給 owner 與協作成員
drop policy if exists "own work_docs" on public.work_docs;
drop policy if exists "work_docs access" on public.work_docs;
create policy "work_docs access" on public.work_docs
  for all using (auth.uid() = user_id or public.is_work_member(user_id))
  with check (auth.uid() = user_id or public.is_work_member(user_id));

-- ── 意見區：協作者針對工作項目回報狀態/意見 ──
create table if not exists public.work_comments (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.work_docs(id) on delete cascade,
  owner_id uuid not null,
  author_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  author_name text not null default '',
  content text not null,
  created_at timestamptz not null default now()
);
create index if not exists work_comments_item_idx on public.work_comments (item_id, created_at);
alter table public.work_comments enable row level security;

drop policy if exists "work_comments access" on public.work_comments;
create policy "work_comments access" on public.work_comments
  for all using (auth.uid() = owner_id or public.is_work_member(owner_id))
  with check (
    author_id = auth.uid()
    and (auth.uid() = owner_id or public.is_work_member(owner_id))
  );

alter publication supabase_realtime add table public.work_comments;
