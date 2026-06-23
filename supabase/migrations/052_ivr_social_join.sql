-- 052: 電話行銷 IVR 按鍵加入社群
-- 流程：Bird 外撥 → IVR 播報 → 客戶按鍵(DTMF) → 後送短連結 → 加入 LINE/WhatsApp/ZALO → webhook 回報綁定
-- 主力 CPaaS = Bird；ZALO 走 Zalo 官方 ZNS。詳見 docs/ivr-社群加入-架構.md
--
-- 權限沿用 scope ACL（新 scope = 'ivr'）：
--   設定類(campaigns/key_mappings) 寫入收歸 settings_owner_ids('ivr')、讀取 accessible_owner_ids('ivr')
--   營運類(calls/join_events) 僅 select 給 accessible_owner_ids('ivr')；寫入由 webhook/server 以 service role 進行

-- 1) 活動設定（設定類）
create table if not exists public.ivr_campaigns (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  voice_script text,                       -- IVR 播報稿
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);
create index if not exists ivr_campaigns_user_idx on public.ivr_campaigns(user_id);

-- 2) 按鍵 → 動作 對應（設定類）
create table if not exists public.ivr_key_mappings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  campaign_id uuid not null references public.ivr_campaigns(id) on delete cascade,
  digit text not null,                     -- '1'..'9','0'
  channel text not null,                   -- 'line' | 'whatsapp' | 'zalo'
  target_type text not null default 'official', -- 'personal' | 'group' | 'official'
  join_url text not null,                  -- 加入連結
  label text,
  created_at timestamptz not null default now(),
  unique (campaign_id, digit)
);
create index if not exists ivr_key_mappings_campaign_idx on public.ivr_key_mappings(campaign_id);
create index if not exists ivr_key_mappings_user_idx on public.ivr_key_mappings(user_id);

-- 3) 每通外撥（營運類）
create table if not exists public.ivr_calls (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  campaign_id uuid references public.ivr_campaigns(id) on delete set null,
  contact_id uuid,                         -- nullable，綁定既有聯絡人
  phone text not null,
  provider text not null default 'bird',
  provider_call_id text,                   -- Bird call id
  status text not null default 'dialing',  -- dialing|answered|no_answer|completed|failed
  pressed_digit text,                      -- nullable，客戶按鍵
  started_at timestamptz not null default now(),
  ended_at timestamptz
);
create index if not exists ivr_calls_user_idx on public.ivr_calls(user_id);
create index if not exists ivr_calls_campaign_idx on public.ivr_calls(campaign_id);
create index if not exists ivr_calls_provider_call_idx on public.ivr_calls(provider_call_id);

-- 4) 按鍵後派送與轉換追蹤（營運類）
create table if not exists public.ivr_join_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  call_id uuid not null references public.ivr_calls(id) on delete cascade,
  channel text not null,                   -- 'line' | 'whatsapp' | 'zalo'
  target_type text not null,
  join_url text not null,
  delivery_method text not null,           -- 'sms' | 'whatsapp' | 'line' | 'zns'
  short_token text unique,                 -- 短連結 token（/api/ivr/r/{token}）
  delivered_at timestamptz,
  clicked_at timestamptz,                  -- 短連結點擊
  joined_at timestamptz,                   -- 平台回報加入/follow
  created_at timestamptz not null default now()
);
create index if not exists ivr_join_events_user_idx on public.ivr_join_events(user_id);
create index if not exists ivr_join_events_call_idx on public.ivr_join_events(call_id);

-- 5) RLS
alter table public.ivr_campaigns    enable row level security;
alter table public.ivr_key_mappings enable row level security;
alter table public.ivr_calls        enable row level security;
alter table public.ivr_join_events  enable row level security;

-- 設定類：讀 accessible、寫 settings（scope='ivr'）
do $$
declare t text;
begin
  foreach t in array array['ivr_campaigns','ivr_key_mappings']
  loop
    execute format('drop policy if exists %I on public.%I', t||'_acl_sel', t);
    execute format('drop policy if exists %I on public.%I', t||'_acl_ins', t);
    execute format('drop policy if exists %I on public.%I', t||'_acl_upd', t);
    execute format('drop policy if exists %I on public.%I', t||'_acl_del', t);
    execute format('create policy %I on public.%I for select to authenticated using (user_id in (select public.accessible_owner_ids(''ivr'')))', t||'_acl_sel', t);
    execute format('create policy %I on public.%I for insert to authenticated with check (user_id in (select public.settings_owner_ids(''ivr'')))', t||'_acl_ins', t);
    execute format('create policy %I on public.%I for update to authenticated using (user_id in (select public.settings_owner_ids(''ivr''))) with check (user_id in (select public.settings_owner_ids(''ivr'')))', t||'_acl_upd', t);
    execute format('create policy %I on public.%I for delete to authenticated using (user_id in (select public.settings_owner_ids(''ivr'')))', t||'_acl_del', t);
  end loop;
end $$;

-- 營運類：僅 select 給 accessible；寫入由 service role（webhook/server）執行，不建 authenticated 寫入 policy
do $$
declare t text;
begin
  foreach t in array array['ivr_calls','ivr_join_events']
  loop
    execute format('drop policy if exists %I on public.%I', t||'_acl_sel', t);
    execute format('create policy %I on public.%I for select to authenticated using (user_id in (select public.accessible_owner_ids(''ivr'')))', t||'_acl_sel', t);
  end loop;
end $$;
