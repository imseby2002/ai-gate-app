-- AI-GATE 桌面連接器（Windows，客人電腦）：裝置配對、任務佇列、社群帳號 ↔ AdsPower 設定檔對應。
-- 連接器以 Bearer 裝置 token 呼叫 /api/connector/*；token 與配對碼只存 SHA-256 雜湊。

create table public.marketing_connector_pair_codes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  code_hash text not null unique,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.marketing_connector_devices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  token_hash text not null unique,
  last_seen_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);
create index marketing_connector_devices_user_idx on public.marketing_connector_devices (user_id);

create table public.marketing_connector_tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  device_id uuid references public.marketing_connector_devices(id) on delete set null,
  account_id uuid references public.marketing_social_accounts(id) on delete cascade,
  type text not null check (type in ('sync_profiles', 'open_profile', 'copilot_post')),
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'pending' check (status in ('pending', 'claimed', 'done', 'failed', 'canceled')),
  result jsonb,
  created_at timestamptz not null default now(),
  claimed_at timestamptz,
  finished_at timestamptz
);
create index marketing_connector_tasks_pending_idx on public.marketing_connector_tasks (user_id, created_at) where status = 'pending';

alter table public.marketing_social_accounts
  add column if not exists adspower_profile_id text,
  add column if not exists connector_device_id uuid references public.marketing_connector_devices(id) on delete set null;

alter table public.marketing_connector_pair_codes enable row level security;
alter table public.marketing_connector_devices enable row level security;
alter table public.marketing_connector_tasks enable row level security;

-- 網頁端（登入者）只能看自己的裝置與任務；寫入一律經伺服器 service role
create policy "connector_devices_select_own" on public.marketing_connector_devices
  for select using (user_id = auth.uid());
create policy "connector_tasks_select_own" on public.marketing_connector_tasks
  for select using (user_id = auth.uid());

-- 連接器領取任務：原子取出該用戶最舊的待辦任務並標記為 claimed
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
      order by created_at
      limit greatest(1, least(p_limit, 20))
      for update skip locked
   )
  returning t.*;
end $$;

revoke all on function public.claim_connector_tasks(uuid, uuid, integer) from public, anon, authenticated;
