-- 會議紀錄（共享即時逐字稿 + 即時翻譯）
-- 每個裝置用瀏覽器 Web Speech API 辨識自己說的話 → 寫入 meeting_lines，
-- 透過 Supabase Realtime 同步到同一場會議的所有參與者；翻譯沿用 /api/work/translate。

-- ── 會議 ────────────────────────────────────────────────────────
create table if not exists public.meetings (
  id uuid primary key default gen_random_uuid(),
  host_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  title text not null default '',
  room_code text not null unique default upper(substr(md5(random()::text), 1, 6)),
  source_lang text not null default 'zh-TW',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  ended_at timestamptz
);
create index if not exists meetings_room_code_idx on public.meetings (room_code);
alter table public.meetings enable row level security;

-- ── 參與者 ──────────────────────────────────────────────────────
create table if not exists public.meeting_participants (
  id uuid primary key default gen_random_uuid(),
  meeting_id uuid not null references public.meetings(id) on delete cascade,
  user_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  name text not null default '',
  created_at timestamptz not null default now(),
  unique (meeting_id, user_id)
);
create index if not exists meeting_participants_meeting_idx on public.meeting_participants (meeting_id);
alter table public.meeting_participants enable row level security;

-- ── 逐字稿（append-only）────────────────────────────────────────
create table if not exists public.meeting_lines (
  id uuid primary key default gen_random_uuid(),
  meeting_id uuid not null references public.meetings(id) on delete cascade,
  speaker_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  speaker_name text not null default '',
  content text not null,
  source_lang text not null default 'zh-TW',
  created_at timestamptz not null default now()
);
create index if not exists meeting_lines_meeting_idx on public.meeting_lines (meeting_id, created_at);
alter table public.meeting_lines enable row level security;

-- ── 成員判定（SECURITY DEFINER，避免 RLS 遞迴；search_path 釘死）──
create or replace function public.is_meeting_participant(p_meeting uuid)
returns boolean language sql security definer stable set search_path = '' as $$
  select exists (
    select 1 from public.meeting_participants
    where meeting_id = p_meeting and user_id = auth.uid()
  ) or exists (
    select 1 from public.meetings
    where id = p_meeting and host_id = auth.uid()
  );
$$;

-- ── 以會議代碼加入（繞過 RLS 的雞生蛋問題；只影響呼叫者本人）──
create or replace function public.join_meeting(p_code text)
returns table (id uuid, title text, host_id uuid, source_lang text)
language plpgsql security definer set search_path = '' as $$
declare
  v_id uuid;
begin
  select m.id into v_id
  from public.meetings m
  where m.room_code = upper(p_code) and m.is_active = true
  limit 1;

  if v_id is null then
    return;
  end if;

  insert into public.meeting_participants (meeting_id, user_id, name)
  values (
    v_id,
    auth.uid(),
    coalesce((select p.full_name from public.profiles p where p.id = auth.uid()), '')
  )
  on conflict (meeting_id, user_id) do nothing;

  return query
    select m.id, m.title, m.host_id, m.source_lang
    from public.meetings m
    where m.id = v_id;
end;
$$;

-- ── RLS ─────────────────────────────────────────────────────────
drop policy if exists "meetings access" on public.meetings;
create policy "meetings access" on public.meetings
  for select using (public.is_meeting_participant(id));

drop policy if exists "meetings insert" on public.meetings;
create policy "meetings insert" on public.meetings
  for insert to authenticated with check (host_id = auth.uid());

drop policy if exists "meetings host update" on public.meetings;
create policy "meetings host update" on public.meetings
  for update using (host_id = auth.uid()) with check (host_id = auth.uid());

drop policy if exists "meeting_participants access" on public.meeting_participants;
create policy "meeting_participants access" on public.meeting_participants
  for select using (public.is_meeting_participant(meeting_id));

drop policy if exists "meeting_participants self insert" on public.meeting_participants;
create policy "meeting_participants self insert" on public.meeting_participants
  for insert to authenticated with check (user_id = auth.uid());

drop policy if exists "meeting_lines access" on public.meeting_lines;
create policy "meeting_lines access" on public.meeting_lines
  for select using (public.is_meeting_participant(meeting_id));

drop policy if exists "meeting_lines insert" on public.meeting_lines;
create policy "meeting_lines insert" on public.meeting_lines
  for insert to authenticated
  with check (speaker_id = auth.uid() and public.is_meeting_participant(meeting_id));

-- ── Realtime：逐字稿即時同步 ────────────────────────────────────
alter publication supabase_realtime add table public.meeting_lines;
