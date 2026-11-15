-- 統一客戶系統（CRM）：跨 RESERVE 預約、BOOKING 訂房、eSIM、AI 客服的客人主檔。
-- crm_contacts   ：一位真實客人一筆（姓名、電話、Email、特質、標籤、累計消費）
-- crm_identities ：客人的各種帳號（LINE / WhatsApp / Messenger / IG / Telegram / 電話 / Email …）
-- crm_activities ：客人的所有紀錄（預約、訂房、購買 eSIM、客服對話、手動備註），可隨時查閱

create table if not exists public.crm_contacts (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  display_name text,
  phone text,              -- 正規化後（只留數字，台灣 09 開頭轉 886）
  email text,              -- 小寫
  gender text,
  birthday date,
  country text,
  tags text[] not null default '{}',
  traits text,             -- 客人特質（偏好、習慣、注意事項）
  notes text,
  ai_summary text,         -- 從客服對話彙整的摘要
  order_count int not null default 0,
  total_spent numeric(12,2) not null default 0,
  first_seen_at timestamptz,
  last_activity_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists crm_contacts_owner_recent_idx on public.crm_contacts (owner_id, last_activity_at desc nulls last);
create index if not exists crm_contacts_owner_phone_idx on public.crm_contacts (owner_id, phone);
create index if not exists crm_contacts_owner_email_idx on public.crm_contacts (owner_id, email);

create table if not exists public.crm_identities (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  contact_id uuid not null references public.crm_contacts(id) on delete cascade,
  kind text not null,      -- line | whatsapp | messenger | instagram | telegram | zalo | wechat | phone | email | other
  value text not null,     -- 平台使用者 ID / 電話 / Email
  label text,              -- 平台上的顯示名稱
  cs_customer_id uuid references public.cs_customers(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (owner_id, kind, value)
);

create index if not exists crm_identities_contact_idx on public.crm_identities (contact_id);

create table if not exists public.crm_activities (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  contact_id uuid not null references public.crm_contacts(id) on delete cascade,
  source text not null,    -- reserve | booking | esim | cs | manual
  source_id text not null, -- 來源資料表的 id（手動紀錄為隨機值）
  kind text not null,      -- appointment | stay | purchase | conversation | note
  title text not null,
  amount numeric(12,2),
  currency text default 'TWD',
  status text,
  occurred_at timestamptz not null default now(),
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_id, source, source_id)
);

create index if not exists crm_activities_contact_idx on public.crm_activities (contact_id, occurred_at desc);

alter table public.crm_contacts enable row level security;
alter table public.crm_identities enable row level security;
alter table public.crm_activities enable row level security;

do $$
declare t text;
begin
  foreach t in array array['crm_contacts', 'crm_identities', 'crm_activities'] loop
    execute format('drop policy if exists %1$s_sel on public.%1$s', t);
    execute format('drop policy if exists %1$s_ins on public.%1$s', t);
    execute format('drop policy if exists %1$s_upd on public.%1$s', t);
    execute format('drop policy if exists %1$s_del on public.%1$s', t);
    execute format('create policy %1$s_sel on public.%1$s for select using (owner_id in (select accessible_owner_ids()))', t);
    execute format('create policy %1$s_ins on public.%1$s for insert with check (owner_id in (select writable_owner_ids()))', t);
    execute format('create policy %1$s_upd on public.%1$s for update using (owner_id in (select writable_owner_ids())) with check (owner_id in (select writable_owner_ids()))', t);
    execute format('create policy %1$s_del on public.%1$s for delete using (owner_id in (select writable_owner_ids()))', t);
  end loop;
end $$;
