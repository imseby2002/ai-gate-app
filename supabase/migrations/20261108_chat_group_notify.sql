-- 個人 LINE 電腦版／Zalo 網頁群組：登記群組（通知／行銷用途）＋連接器任務 chat_notify（客服通知全自動送出）
create table if not exists public.marketing_chat_groups (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  app text not null check (app in ('line_pc', 'zalo_web')),
  account_id uuid references public.marketing_social_accounts(id) on delete set null, -- Zalo：AdsPower 帳號；LINE：不需要
  name text not null,                                                  -- 聊天名稱（自動化搜尋與確認用，需與 LINE／Zalo 顯示完全一致）
  purpose text not null default 'notify' check (purpose in ('notify', 'marketing')),
  note text,
  created_at timestamptz not null default now()
);
create index if not exists marketing_chat_groups_user_idx on public.marketing_chat_groups (user_id, purpose);
alter table public.marketing_chat_groups enable row level security;

alter table public.marketing_connector_tasks add column if not exists run_after timestamptz;
alter table public.marketing_connector_tasks drop constraint if exists marketing_connector_tasks_type_check;
alter table public.marketing_connector_tasks
  add constraint marketing_connector_tasks_type_check
  check (type in ('sync_profiles', 'open_profile', 'copilot_post', 'copilot_chat', 'chat_notify'));

-- 領取任務時略過尚未到時間的排程任務
create or replace function public.claim_connector_tasks(p_user_id uuid, p_device_id uuid, p_limit integer default 5)
returns setof public.marketing_connector_tasks
language plpgsql security definer set search_path to 'public' as $$
begin
  return query
  update public.marketing_connector_tasks t
     set status = 'claimed', device_id = p_device_id, claimed_at = now()
   where t.id in (
     select id from public.marketing_connector_tasks
      where user_id = p_user_id and status = 'pending'
        and (device_id is null or device_id = p_device_id)
        and (run_after is null or run_after <= now())
      order by coalesce(run_after, created_at)
      limit greatest(1, least(p_limit, 20))
      for update skip locked
   )
  returning t.*;
end $$;
revoke all on function public.claim_connector_tasks(uuid, uuid, integer) from public, anon, authenticated;
