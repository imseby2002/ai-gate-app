-- 會議紀錄瀏覽權限：
-- 1) 公司負責人／IT 管理員（company_members.role = owner/admin）可瀏覽同公司成員主持的所有會議
-- 2) 主持人可授權特定同事瀏覽「自己主持的所有會議」（例：總經理特助授權總經理）
-- 瀏覽者只能看（逐字稿、參與者、聊天），不能寫入逐字稿（INSERT 仍要求是參與者）
create table if not exists public.meeting_viewer_grants (
  id uuid primary key default gen_random_uuid(),
  host_id uuid not null references auth.users(id) on delete cascade,
  viewer_id uuid not null references auth.users(id) on delete cascade,
  granted_by uuid,
  created_at timestamptz not null default now(),
  unique (host_id, viewer_id)
);
alter table public.meeting_viewer_grants enable row level security;
create index if not exists meeting_viewer_grants_viewer_idx on public.meeting_viewer_grants(viewer_id);

create or replace function public.can_view_meeting(p_meeting uuid)
returns boolean language sql security definer stable set search_path = '' as $$
  select public.is_meeting_participant(p_meeting)
  or exists (
    select 1 from public.meetings m
    join public.meeting_viewer_grants g on g.host_id = m.host_id and g.viewer_id = auth.uid()
    where m.id = p_meeting
  )
  or exists (
    select 1 from public.meetings m
    join public.company_members host_m on host_m.member_id = m.host_id and host_m.status = 'active'
    join public.company_members me on me.company_id = host_m.company_id and me.member_id = auth.uid()
      and me.status = 'active' and me.role in ('owner', 'admin')
    where m.id = p_meeting
  );
$$;

alter policy "meetings access" on public.meetings using (public.can_view_meeting(id));
alter policy "meeting_lines access" on public.meeting_lines using (public.can_view_meeting(meeting_id));
alter policy "meeting_participants access" on public.meeting_participants using (public.can_view_meeting(meeting_id));
