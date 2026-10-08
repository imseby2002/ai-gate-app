-- =============================================
-- AI GATE - Migration 20261008 (affairs expansion)
-- 外務系統擴充：
--  1. 門市開發：候選點位（街邊／MALL／公家部門／私人部門），含申請與資格審核進度、位置市場分析
--  2. 關係維護：房東、MALL 管理人員、公家部門、私人部門等聯絡人與往來紀錄
--  3. 區域租金評比：手動輸入或 AI 搜尋的租金行情，用於漲跌分析
-- =============================================

create table if not exists public.affair_contacts (
  id               uuid primary key default gen_random_uuid(),
  owner_id         uuid not null references public.profiles(id) on delete cascade,
  category         text not null default 'other',   -- landlord / mall / public / private / other
  org_type         text not null default '',        -- 公家：investment / health / market_security / economic_security / tax / fire / environment / labor / customs / airport / gov_zone；私人：factory / market
  name             text not null,
  title            text not null default '',        -- 職稱
  organization     text not null default '',        -- 單位／公司／MALL 名稱
  phone            text not null default '',
  email            text not null default '',
  im               text not null default '',        -- LINE / Zalo / WeChat
  region           text not null default '',
  traits           text not null default '',        -- 個人特質、喜好、溝通注意事項
  importance       int  not null default 3,         -- 1–5
  last_contact_at  date,
  next_followup    date,
  store_code       text not null default '',
  notes            text not null default '',
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index if not exists idx_affair_contacts_owner on public.affair_contacts(owner_id, category);

create table if not exists public.affair_contact_logs (
  id           uuid primary key default gen_random_uuid(),
  owner_id     uuid not null references public.profiles(id) on delete cascade,
  contact_id   uuid not null references public.affair_contacts(id) on delete cascade,
  log_date     date not null default current_date,
  kind         text not null default 'visit',        -- visit / call / meal / gift / meeting / message / other
  summary      text not null default '',
  next_action  text not null default '',
  created_at   timestamptz not null default now()
);
create index if not exists idx_affair_contact_logs_contact on public.affair_contact_logs(contact_id, log_date desc);

create table if not exists public.affair_sites (
  id                    uuid primary key default gen_random_uuid(),
  owner_id              uuid not null references public.profiles(id) on delete cascade,
  name                  text not null,
  category              text not null default 'street',  -- street / mall / public / private
  subtype               text not null default '',        -- street: ground_large / ground_small / shop_in_shop / counter / delivery；mall: community / non_community；public: airport / gov_zone / public_other；private: factory / market / private_other
  address               text not null default '',
  region                text not null default '',
  floor                 text not null default '',
  area_sqm              numeric,
  frontage_m            numeric,                          -- 門面寬度（公尺）
  monthly_rent          numeric,
  deposit               numeric,
  households            int,                              -- 社區型 MALL 住戶數
  contact_id            uuid references public.affair_contacts(id) on delete set null,
  status                text not null default 'prospect', -- prospect / visiting / negotiating / applying / reviewing / approved / signed / rejected / dropped
  application_deadline  date,
  application           jsonb not null default '[]'::jsonb, -- 申請／資格審核步驟 [{ step, done, due, note }]
  notes                 text not null default '',
  analysis              jsonb,                            -- 最新一次位置市場分析
  analysis_at           timestamptz,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);
create index if not exists idx_affair_sites_owner on public.affair_sites(owner_id, status);

create table if not exists public.affair_rent_benchmarks (
  id            uuid primary key default gen_random_uuid(),
  owner_id      uuid not null references public.profiles(id) on delete cascade,
  region        text not null default '',
  address       text not null default '',
  subtype       text not null default '',
  area_sqm      numeric,
  monthly_rent  numeric not null,
  currency      text not null default '',
  observed_at   date not null default current_date,
  source        text not null default 'manual',      -- manual / ai
  source_url    text not null default '',
  contact_id    uuid references public.affair_contacts(id) on delete set null,
  notes         text not null default '',
  created_at    timestamptz not null default now()
);
create index if not exists idx_affair_rent_owner on public.affair_rent_benchmarks(owner_id, region, observed_at);

do $$
declare t text;
begin
  foreach t in array array['affair_contacts','affair_contact_logs','affair_sites','affair_rent_benchmarks'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists %I on public.%I', t || '_owner', t);
    execute format('create policy %I on public.%I for all using (owner_id = auth.uid()) with check (owner_id = auth.uid())', t || '_owner', t);
    execute format('drop policy if exists %I on public.%I', t || '_admin', t);
    execute format('create policy %I on public.%I for all using (public.is_admin())', t || '_admin', t);
  end loop;
end $$;
