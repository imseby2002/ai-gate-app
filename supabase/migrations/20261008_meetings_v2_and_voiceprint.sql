-- =============================================
-- AI GATE - Migration 20261008
-- 會議系統升級：主題、部門、門市、背景關鍵字、會議模式（實體/線上）
-- 與員工聲紋註冊（employee_voice_profiles）
-- =============================================

alter table public.meetings
  add column if not exists department text not null default '',
  add column if not exists departments text[] not null default '{}',
  add column if not exists meeting_mode text not null default 'online', -- 'online' | 'in_person'
  add column if not exists stores text[] not null default '{}',
  add column if not exists context_keywords text not null default '';

-- 員工專屬聲紋檔案（固定句子朗讀註冊）
create table if not exists public.employee_voice_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade unique,
  audio_url text not null default '',
  language text not null default 'vi-VN',
  fixed_text text not null default '',
  status text not null default 'pending', -- 'pending' | 'enrolled'
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.employee_voice_profiles enable row level security;

drop policy if exists "voice_profiles_select" on public.employee_voice_profiles;
create policy "voice_profiles_select" on public.employee_voice_profiles
  for select using (auth.uid() is not null);

drop policy if exists "voice_profiles_self_manage" on public.employee_voice_profiles;
create policy "voice_profiles_self_manage" on public.employee_voice_profiles
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- 更新 join_meeting 函式以回傳新增欄位
drop function if exists public.join_meeting(text);

create or replace function public.join_meeting(p_code text)
returns table (
  id uuid,
  title text,
  host_id uuid,
  source_lang text,
  department text,
  departments text[],
  meeting_mode text,
  stores text[],
  context_keywords text
)
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
    select m.id, m.title, m.host_id, m.source_lang, m.department, m.departments, m.meeting_mode, m.stores, m.context_keywords
    from public.meetings m
    where m.id = v_id;
end;
$$;
