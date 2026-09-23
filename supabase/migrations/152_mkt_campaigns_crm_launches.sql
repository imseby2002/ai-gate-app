-- 152_mkt_campaigns_crm_launches.sql
-- 整合行銷活動中心、零售 CRM 會員與研發新品 VIP 搶先上架資料表

-- 1. 整合行銷活動主表 (mkt_campaigns)
create table if not exists public.mkt_campaigns (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  channel_type text not null default 'offline', -- 'offline' 實體 | 'online' 線上 | 'hybrid' 虛實整合
  category text not null default 'event',      -- 'material' 門市物料 | 'event' 地推/活動 | 'outdoor' 戶外廣告 | 'partner' 異業合作 | 'social_promo' 社群促銷 | 'delivery_promo' 外送促銷 | 'member_exclusive' 會員專享
  store text not null default '',              -- 門市（空字串＝全門市）
  status text not null default 'planned',      -- 'draft' 草案 | 'planned' 已排程 | 'active' 執行中 | 'ended' 已結案 | 'cancelled' 取消
  start_date date,
  end_date date,
  budget numeric not null default 0,           -- 規劃預算
  actual_spend numeric not null default 0,     -- 實際花費
  counterparty text not null default '',       -- 合作廠商 / 對象
  photo_url text not null default '',          -- 主要封面 / 照片
  photo_urls jsonb not null default '[]'::jsonb, -- 多圖證明
  note text not null default '',               -- 人工備註
  ai_brief text not null default '',           -- AI 企劃原始提示詞
  ai_proposal jsonb not null default '{}'::jsonb, -- AI 生成的完整企劃 (slogan, theme, mechanics, social_copy, staff_script, checklist)
  target_products jsonb not null default '[]'::jsonb, -- 關聯或促銷商品清單
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_mkt_campaigns_owner on public.mkt_campaigns(owner_id, channel_type, status);
create index if not exists idx_mkt_campaigns_dates on public.mkt_campaigns(owner_id, start_date, end_date);

alter table public.mkt_campaigns enable row level security;
drop policy if exists mkt_campaigns_admin on public.mkt_campaigns;
create policy mkt_campaigns_admin on public.mkt_campaigns for all using (is_admin());
drop policy if exists mkt_campaigns_owner on public.mkt_campaigns;
create policy mkt_campaigns_owner on public.mkt_campaigns for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());

-- 2. 舊 mkt_offline 資料無失真遷移
do $$
begin
  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'mkt_offline') then
    insert into public.mkt_campaigns (
      id, owner_id, title, channel_type, category, store, status,
      start_date, end_date, budget, actual_spend, counterparty, photo_url, note, created_at, updated_at
    )
    select
      id, owner_id, title, 'offline', type, store, status,
      start_date, end_date, budget, budget, counterparty, photo_url, note, created_at, updated_at
    from public.mkt_offline
    on conflict (id) do nothing;
  end if;
end $$;

-- 3. 零售會員 CRM 主表 (crm_customers)
create table if not exists public.crm_customers (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  phone text not null,
  name text not null default '',
  email text not null default '',
  line_uid text not null default '',
  zalo_id text not null default '',
  tier text not null default 'general',        -- 'general' 一般 | 'silver' 白銀 | 'gold' 黃金 | 'vip' VIP | 'vvip' 尊爵VVIP
  tags jsonb not null default '[]'::jsonb,     -- 標籤，例如: ['新品控', '常客', '週末高客單']
  total_spend numeric not null default 0,      -- 累計消費金額
  order_count int not null default 0,          -- 累計消費次數
  last_order_at timestamptz,                   -- 最後消費時間
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_id, phone)
);

create index if not exists idx_crm_customers_owner on public.crm_customers(owner_id, tier);
create index if not exists idx_crm_customers_phone on public.crm_customers(owner_id, phone);

alter table public.crm_customers enable row level security;
drop policy if exists crm_customers_admin on public.crm_customers;
create policy crm_customers_admin on public.crm_customers for all using (is_admin());
drop policy if exists crm_customers_owner on public.crm_customers;
create policy crm_customers_owner on public.crm_customers for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());

-- 4. 研發新品上架與 VIP 搶先期排程 (mkt_product_launches)
create table if not exists public.mkt_product_launches (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  product_id uuid references public.mkt_product_profiles(id) on delete set null,
  recipe_id uuid references public.rd_recipes(id) on delete set null,
  pos_item_id uuid references public.pos_items(id) on delete set null,
  name text not null,
  status text not null default 'mkt_prep',     -- 'rd_submitted' 研發已提交 | 'mkt_prep' 行銷籌備包裝中 | 'vip_exclusive' VIP專享搶先期 | 'public_released' 全面上市 | 'archived' 已下架存檔
  vip_start_date date,
  vip_end_date date,
  vip_tiers jsonb not null default '["vip", "vvip"]'::jsonb,
  vip_discount_type text default 'early_bird', -- 'early_bird' 專屬搶先試飲 | 'discount' 專屬折扣 | 'gift' 買一送一/贈品
  vip_notes text not null default '',
  public_release_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_mkt_product_launches_owner on public.mkt_product_launches(owner_id, status);

alter table public.mkt_product_launches enable row level security;
drop policy if exists mkt_product_launches_admin on public.mkt_product_launches;
create policy mkt_product_launches_admin on public.mkt_product_launches for all using (is_admin());
drop policy if exists mkt_product_launches_owner on public.mkt_product_launches;
create policy mkt_product_launches_owner on public.mkt_product_launches for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());
