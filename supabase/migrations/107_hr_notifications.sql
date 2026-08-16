-- =============================================
-- AI GATE - Migration 107
-- HR 通知整合：
--  1) 站內提醒 hr_notifications（免金鑰，永遠可用）
--  2) hr_settings 增通知管道偏好（Telegram / Email 開關；站內恆開）
--  3) 應徵者通知管道（Email / ZALO）與 ZALO user id
--  4) 文件全上傳已通知旗標，避免重複通知
-- Telegram / ZALO token 沿用既有 social_platform_credentials（後台可設定，不寫死）。
-- =============================================

-- 1) 站內提醒
create table if not exists public.hr_notifications (
  id           uuid primary key default gen_random_uuid(),
  owner_id     uuid not null references public.profiles(id) on delete cascade,
  kind         text not null default '',          -- new_application / docs_complete / ...
  title        text not null default '',
  body         text not null default '',
  candidate_id uuid references public.agent_hr_candidates(id) on delete set null,
  is_read      boolean not null default false,
  created_at   timestamptz not null default now()
);
create index if not exists idx_hr_notifications_owner on public.hr_notifications(owner_id, is_read, created_at desc);

alter table public.hr_notifications enable row level security;
drop policy if exists "hr_notifications_owner" on public.hr_notifications;
create policy "hr_notifications_owner" on public.hr_notifications
  for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());
drop policy if exists "hr_notifications_admin" on public.hr_notifications;
create policy "hr_notifications_admin" on public.hr_notifications
  for all using (public.is_admin());

-- 2) 人事通知管道偏好（站內恆開，Telegram/Email 可選）
alter table public.hr_settings
  add column if not exists notify_telegram boolean not null default false,
  add column if not exists notify_email    boolean not null default false;

-- 3) 應徵者通知管道
alter table public.agent_hr_candidates
  add column if not exists notify_channel text not null default 'email',  -- email | zalo
  add column if not exists zalo_user_id   text not null default '',
  add column if not exists docs_upload_notified boolean not null default false;

alter table public.agent_hr_candidates
  drop constraint if exists agent_hr_candidates_notify_channel_check;
alter table public.agent_hr_candidates
  add constraint agent_hr_candidates_notify_channel_check
  check (notify_channel in ('email', 'zalo'));
