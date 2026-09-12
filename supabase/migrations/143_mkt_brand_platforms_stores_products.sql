-- 143_mkt_brand_platforms_stores_products.sql
-- 擴充品牌官方社群平台、門市行銷圖文擴充表、產品行銷圖文庫

-- 1. 品牌檔增加社群與平台通路欄位 (platforms)
alter table if exists public.mkt_brand
  add column if not exists platforms jsonb not null default '{}'::jsonb;

-- 2. 門市行銷擴充表 (mkt_store_profiles)
-- 依據 OFFICE 門市主檔 (fin_stores.id)，儲存門市對外行銷照片、故事簡介、營業時間、Google Maps 連結與外送平台
create table if not exists public.mkt_store_profiles (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  store_id uuid not null references public.fin_stores(id) on delete cascade,
  photos jsonb not null default '[]'::jsonb,           -- 門面照、室內裝潢照、氛圍圖 URL 清單
  story text not null default '',                      -- 門市亮點簡介與故事
  opening_hours text not null default '',              -- 對外營業時間
  google_maps_url text not null default '',            -- Google 商家地圖導航連結
  delivery_urls jsonb not null default '{}'::jsonb,    -- { grab, shopee, baemin, foodpanda, ubereats }
  features jsonb not null default '[]'::jsonb,         -- 門市特色標籤: ['近捷運', '免費WiFi', '插座', '包廂']
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_id, store_id)
);

create index if not exists idx_mkt_store_profiles_owner on public.mkt_store_profiles(owner_id);
create index if not exists idx_mkt_store_profiles_store on public.mkt_store_profiles(store_id);

alter table public.mkt_store_profiles enable row level security;
create policy mkt_store_profiles_admin on public.mkt_store_profiles for all using (is_admin());
create policy mkt_store_profiles_owner on public.mkt_store_profiles for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());

-- 3. 產品行銷圖文資產表 (mkt_product_profiles)
-- 儲存高解析度商品圖、去背圖、宣傳文案、Slogan、風味口感特色、行銷標籤
-- 可選關聯 pos_items 或 inv_recipes
create table if not exists public.mkt_product_profiles (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  product_code text not null default '',               -- 商品/原料編碼
  name text not null,                                  -- 商品對外行銷名稱
  category text not null default '一般',               -- 商品分類
  price numeric not null default 0,                    -- 建議售價
  images jsonb not null default '[]'::jsonb,           -- 高清去背圖、情境海報圖 URL 清單
  slogan text not null default '',                     -- 一句話賣點
  description text not null default '',                -- 美味口感介紹 / 產品故事
  flavor_notes text not null default '',               -- 風味筆記 / 甜度冰塊推薦
  tags jsonb not null default '[]'::jsonb,             -- ['新品上市', '人氣熱銷', '招牌必喝', '季節限定']
  recipe_id uuid references public.inv_recipes(id) on delete set null,
  pos_item_id uuid references public.pos_items(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_mkt_product_profiles_owner on public.mkt_product_profiles(owner_id);
create index if not exists idx_mkt_product_profiles_code on public.mkt_product_profiles(owner_id, product_code);

alter table public.mkt_product_profiles enable row level security;
create policy mkt_product_profiles_admin on public.mkt_product_profiles for all using (is_admin());
create policy mkt_product_profiles_owner on public.mkt_product_profiles for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());
