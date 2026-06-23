-- 053: 電話行銷潛在客戶名單持久化 + 去重
-- 搜尋到的客戶寫入主檔，跨多次搜尋以 dedup_key 去重累積；
-- 供頁面載入時直接讀回、避免重複撥打、累計出現次數。

create table if not exists public.prospect_orgs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  dedup_key text not null,            -- phone_normalized 優先，無電話則 name+address 正規化
  name text not null,
  phone_normalized text,
  address text,
  ai_category text,
  raw jsonb,                          -- 原始/完整欄位（lat/lng/website/email/rating…）
  selected boolean not null default true,  -- 工作選取狀態（續做時還原）
  call_status text,                   -- null | 'called' | 'joined'（已撥/已加入標記）
  called_at timestamptz,
  search_count integer not null default 1,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  unique (user_id, dedup_key)
);
create index if not exists prospect_orgs_user_idx on public.prospect_orgs(user_id);
create index if not exists prospect_orgs_user_seen_idx on public.prospect_orgs(user_id, last_seen_at desc);

alter table public.prospect_orgs enable row level security;

-- 個人名單：擁有者自管（self）
drop policy if exists prospect_orgs_sel on public.prospect_orgs;
drop policy if exists prospect_orgs_ins on public.prospect_orgs;
drop policy if exists prospect_orgs_upd on public.prospect_orgs;
drop policy if exists prospect_orgs_del on public.prospect_orgs;
create policy prospect_orgs_sel on public.prospect_orgs for select to authenticated using (user_id = auth.uid());
create policy prospect_orgs_ins on public.prospect_orgs for insert to authenticated with check (user_id = auth.uid());
create policy prospect_orgs_upd on public.prospect_orgs for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy prospect_orgs_del on public.prospect_orgs for delete to authenticated using (user_id = auth.uid());
