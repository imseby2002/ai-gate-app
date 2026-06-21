-- 內容自動翻譯快取（所有登入者共享）
create table if not exists public.work_translations (
  source_hash text not null,
  target_lang text not null,
  source text not null,
  translated text not null,
  created_at timestamptz not null default now(),
  primary key (source_hash, target_lang)
);
alter table public.work_translations enable row level security;
drop policy if exists "work_translations read" on public.work_translations;
create policy "work_translations read" on public.work_translations
  for select using (auth.uid() is not null);
drop policy if exists "work_translations insert" on public.work_translations;
create policy "work_translations insert" on public.work_translations
  for insert with check (auth.uid() is not null);

-- 每個工作項目各自的協作成員（取代工作區層級協作）
create table if not exists public.work_item_members (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.work_docs(id) on delete cascade,
  owner_id uuid not null,
  invited_email text not null,
  member_id uuid references public.profiles(id) on delete cascade,
  status text not null default 'pending',
  created_at timestamptz not null default now(),
  unique (item_id, invited_email)
);
create index if not exists work_item_members_item_idx on public.work_item_members (item_id);
create index if not exists work_item_members_member_idx on public.work_item_members (member_id);
alter table public.work_item_members enable row level security;

drop policy if exists "work_item_members owner" on public.work_item_members;
create policy "work_item_members owner" on public.work_item_members
  for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

drop policy if exists "work_item_members self read" on public.work_item_members;
create policy "work_item_members self read" on public.work_item_members
  for select using (
    auth.uid() = member_id
    or lower(invited_email) = lower((auth.jwt() ->> 'email'))
  );

create or replace function public.is_work_item_member(p_item uuid)
returns boolean language sql security definer stable as $$
  select exists (
    select 1 from public.work_item_members
    where item_id = p_item and member_id = auth.uid() and status = 'active'
  );
$$;

create or replace function public.claim_work_invitations()
returns void language plpgsql security definer as $$
begin
  update public.work_members
    set member_id = auth.uid(), status = 'active'
    where member_id is null and lower(invited_email) = lower((auth.jwt() ->> 'email'));
  update public.work_item_members
    set member_id = auth.uid(), status = 'active'
    where member_id is null and lower(invited_email) = lower((auth.jwt() ->> 'email'));
end;
$$;

-- work_docs / work_comments 改以「項目層級」協作判斷
drop policy if exists "work_docs access" on public.work_docs;
create policy "work_docs access" on public.work_docs
  for all using (auth.uid() = user_id or public.is_work_item_member(id))
  with check (auth.uid() = user_id or public.is_work_item_member(id));

drop policy if exists "work_comments access" on public.work_comments;
create policy "work_comments access" on public.work_comments
  for all using (auth.uid() = owner_id or public.is_work_item_member(item_id))
  with check (
    author_id = auth.uid()
    and (auth.uid() = owner_id or public.is_work_item_member(item_id))
  );

alter publication supabase_realtime add table public.work_item_members;
