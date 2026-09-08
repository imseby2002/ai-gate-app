-- =============================================
-- AI GATE - Migration 147
-- Feeling Tea AI R&D Lab (研發數位大腦)
-- 原料庫 + 結構化配方 + 供應商矩陣 + 實驗管理 + 感官評估 +
-- 成本模型 + 法規檢查 + 食品添加物 + 競品情報 + 外部研發知識
-- =============================================

-- 1. 原料資料庫 (Ingredient Cards)
create table if not exists public.rd_ingredients (
  id                uuid primary key default gen_random_uuid(),
  owner_id          uuid not null references public.profiles(id) on delete cascade,
  code              text not null default '',             -- ING-000123
  name              text not null,                       -- 原料名稱
  supplier_id       uuid references public.fin_vendors(id) on delete set null,
  supplier_name     text not null default '',            -- 供應商名稱
  supplier_item_code text not null default '',           -- 廠商型號 (如 A公司-9095)
  origin            text not null default 'Vietnam',     -- 產地 (Vietnam, Taiwan, etc.)
  category          text not null default 'tea',         -- tea | dairy | sugar | foam | syrup | juice | topping | additive | package | ice | other
  brix              numeric default 0,                   -- 糖度 °Brix
  ph                numeric default 7.0,                 -- 酸鹼度 pH
  moisture          numeric default 0,                   -- 水分 %
  density           numeric default 1.0,                 -- 密度 g/ml
  cost_per_kg       numeric not null default 0,          -- 成本 (VND/kg 或 VND/unit)
  shelf_life_days   int default 365,                     -- 保存期限 (天)
  storage_condition text not null default 'ambient',     -- ambient 常溫 | chilled 冷藏 | frozen 冷凍
  allergen          text not null default 'none',        -- dairy | nuts | soy | gluten | none
  halal             boolean default false,               -- 清真認證
  specification     text not null default '',            -- 規格說明
  coa_url           text not null default '',            -- COA 檢驗證明連結
  -- 感官評估資料 (1-10 雷達)
  aroma             numeric default 5.0,                 -- 香氣
  astringency       numeric default 5.0,                 -- 澀度
  bitterness        numeric default 5.0,                 -- 苦味
  body              numeric default 5.0,                 -- 茶感/醇厚度
  aftertaste        numeric default 5.0,                 -- 回甘
  color             text not null default '',            -- 外觀顏色描述
  mouthfeel         text not null default '',            -- 口感特徵
  sensory_notes     text not null default '',            -- 風味評價
  -- 採購商業參數
  moq               numeric default 1,                   -- 最小訂購量
  lead_time_days    int default 3,                       -- 交期天數
  quality_stability numeric default 4.5,                 -- 品質穩定度 1-5 星
  batch_variance_notes text not null default '',         -- 批次差異筆記
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index if not exists idx_rd_ingredients_owner on public.rd_ingredients(owner_id, category);

-- 2. 結構化配方主表 (Structured Recipes with Versioning)
create table if not exists public.rd_recipes_v2 (
  id                uuid primary key default gen_random_uuid(),
  owner_id          uuid not null references public.profiles(id) on delete cascade,
  product_id        text not null default '',            -- 關聯產品 ID
  name              text not null,                       -- 飲品名稱 (例: Oolong Milk Tea)
  code              text not null default '',            -- 產品代碼 (例: DRK-001)
  category          text not null default 'milk_tea',    -- tea | milk_tea | fruit_tea | coffee | special | dessert
  cup_size_ml       numeric not null default 500,        -- 杯量 (ml, 如 500, 700)
  version           text not null default 'V1',          -- V1, V2, V3, V4...
  is_current_active boolean not null default false,      -- 是否為目前門市使用版本
  status            text not null default 'testing',     -- draft | testing | approved | production | archived
  total_weight_g    numeric not null default 0,          -- 成品總重 (g)
  total_volume_ml   numeric not null default 500,        -- 成品容量 (ml)
  estimated_brix    numeric not null default 0,          -- 加權糖度 (°Brix)
  sugar_per_100ml   numeric not null default 0,          -- 每 100ml 糖克數 (g/100ml)
  cogs_amount       numeric not null default 0,          -- 每杯總成本 (COGS, VND)
  target_price      numeric not null default 0,          -- 門市建議售價 (VND)
  gross_margin_pct  numeric not null default 0,          -- 毛利率 (%)
  legal_warning     text not null default '',            -- 法規預警 (如: 超過 5g/100ml 越南特別消費稅課徵提示)
  notes             text not null default '',            -- 研發備註 / 調製標準 SOP
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index if not exists idx_rd_recipes_v2_owner on public.rd_recipes_v2(owner_id, name);

-- 3. 配方成分項目 (Recipe Ingredients Items)
create table if not exists public.rd_recipe_ingredients (
  id                uuid primary key default gen_random_uuid(),
  recipe_id         uuid not null references public.rd_recipes_v2(id) on delete cascade,
  ingredient_id     uuid references public.rd_ingredients(id) on delete set null,
  name              text not null,                       -- 原料名稱 (Tea, Milk, Syrup, Water, Ice...)
  category          text not null default 'other',       -- tea | milk | sugar | foam | syrup | juice | topping | ice | water | package
  qty_g             numeric not null default 0,          -- 原料重量 (g)
  ratio_pct         numeric default 0,                   -- 原料比例 (%)
  cost_per_unit     numeric default 0,                   -- 單價
  cost_amount       numeric default 0,                   -- 本項成本金額 (VND)
  brix              numeric default 0,                   -- 該原料糖度
  sugar_g           numeric default 0,                   -- 該原料貢獻糖重 (g)
  sort_order        int default 0
);

create index if not exists idx_rd_recipe_ingredients on public.rd_recipe_ingredients(recipe_id);

-- 4. 實驗管理 (Experiment Protocol & Lab Records)
create table if not exists public.rd_experiments (
  id                uuid primary key default gen_random_uuid(),
  owner_id          uuid not null references public.profiles(id) on delete cascade,
  code              text not null,                       -- EXP-2026-0826-001
  product_name      text not null default '',            -- 實驗產品 (例: Brown Sugar Milk Tea)
  objective         text not null default '',            -- 實驗目的 (例: 降低甜膩感、增強回甘)
  hypothesis        text not null default '',            -- 實驗假說
  recipe_id         uuid references public.rd_recipes_v2(id) on delete set null,
  control_group     jsonb not null default '{}'::jsonb,  -- 對照組配方與參數
  variants          jsonb not null default '[]'::jsonb,  -- A, B, C 實驗變因方案與結果
  conclusion        text not null default '',            -- 實驗結論
  rating            numeric default 5.0,                 -- 評分 (1-5 星)
  status            text not null default 'completed',   -- planning | testing | completed | applied
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index if not exists idx_rd_experiments_owner on public.rd_experiments(owner_id, created_at desc);

-- 5. 感官評分 (Sensory Evaluation: 9 大標準維度 1-10)
create table if not exists public.rd_sensory_evaluations (
  id                uuid primary key default gen_random_uuid(),
  owner_id          uuid not null references public.profiles(id) on delete cascade,
  experiment_id     uuid references public.rd_experiments(id) on delete set null,
  recipe_id         uuid references public.rd_recipes_v2(id) on delete set null,
  sample_name       text not null default '',            -- 樣品名稱 / 輪次 (例: 方案 C)
  tester_name       text not null default '',            -- 評審品評員
  sweetness         numeric not null default 5,          -- 甜度 (1-10)
  tea_aroma         numeric not null default 5,          -- 茶香 (1-10)
  tea_strength      numeric not null default 5,          -- 茶感 (1-10)
  milkiness         numeric not null default 5,          -- 奶感 (1-10)
  bitterness        numeric not null default 5,          -- 苦味 (1-10)
  astringency       numeric not null default 5,          -- 澀度 (1-10)
  aftertaste        numeric not null default 5,          -- 回甘 (1-10)
  mouthfeel         numeric not null default 5,          -- 口感 (1-10)
  overall           numeric not null default 5,          -- 綜合評分 (1-10)
  comments          text not null default '',            -- 品評評論 (例: 入口香，但 10 秒後澀味出來)
  created_at        timestamptz not null default now()
);

create index if not exists idx_rd_sensory_owner on public.rd_sensory_evaluations(owner_id, created_at desc);

-- 6. 食品添加物資料庫 (INS Food Additives & Regulatory Reference)
create table if not exists public.rd_food_additives (
  id                uuid primary key default gen_random_uuid(),
  name              text not null,                       -- 添加物名稱 (例: 鹿角菜膠 Carrageenan)
  ins_number        text not null,                       -- INS 編號 (例: INS 407)
  function          text not null default '',            -- 功能 (增稠劑, 安定劑, 酸度調節劑...)
  max_usage         text not null default 'GMP',         -- 最大使用量 (g/kg 或 GMP)
  food_category     text not null default '飲料類',      -- 適用食品類別
  vietnam_status    text not null default '允許使用',    -- 越南法規狀態
  taiwan_status     text not null default '允許使用',    -- 台灣法規狀態
  eu_status         text not null default 'Approved',    -- 歐盟法規狀態
  us_status         text not null default 'GRAS',        -- 美國 FDA 狀態
  regulatory_source text not null default 'Thông tư 24/2019/TT-BYT', -- 法規依據
  notes             text not null default ''
);

-- 7. 競品資料庫 (Competitor Products Intelligence)
create table if not exists public.rd_competitor_products (
  id                uuid primary key default gen_random_uuid(),
  owner_id          uuid not null references public.profiles(id) on delete cascade,
  brand_name        text not null,                       -- Phúc Long, Highlands, Gong Cha, Katinat, KOI, Mixue...
  product_name      text not null,                       -- 產品名稱 (例: Trà Sữa Phúc Long)
  price_vnd         numeric not null default 0,          -- 售價 VND
  cup_size_ml       numeric default 500,                 -- 杯量 ml
  sweetness_level   text not null default '100%',        -- 預設甜度
  toppings          text not null default '',            -- 內附或常見 Topping
  packaging         text not null default '',            -- 杯身包材特色
  season_promotion  text not null default '',            -- 季節檔期 / 促銷方案
  notes             text not null default '',            -- 市場評價與特色
  created_at        timestamptz not null default now()
);

create index if not exists idx_rd_competitor_owner on public.rd_competitor_products(owner_id, brand_name);

-- 8. 外部研發知識學習庫 (External R&D Knowledge: YouTube / Paper / Patent)
create table if not exists public.rd_external_knowledge (
  id                uuid primary key default gen_random_uuid(),
  owner_id          uuid not null references public.profiles(id) on delete cascade,
  source_type       text not null default 'youtube',     -- youtube | article | pdf | paper | patent | expert | trend
  source_url        text not null default '',            -- 原始網址 / 檔案路徑
  author            text not null default '',            -- 作者 / YouTuber / 機構
  title             text not null,                       -- 標題
  topic             text not null default '風味科學',    -- 萃取技術 | 風味化學 | 乳品乳化 | 保存期限...
  content_text      text not null default '',            -- 原始內文 / Transcript
  summary           text not null default '',            -- 萃取知識重點摘要
  evidence_level    text not null default 'D',           -- A: 權威同行審查 | B: 技術規範 | C: 專家經驗 | D: YouTube/社群 | E: 未驗證說法
  confidence        text not null default 'medium',      -- high | medium | low
  governance_status text not null default 'external',    -- external | internal | experimental | approved
  tags              text[] default '{}',                 -- 標籤 (冷泡, 酯化, 焦糖化, 穩定劑...)
  metadata          jsonb not null default '{}'::jsonb,  -- 額外資訊 (章節, 頁碼, 專利號...)
  created_at        timestamptz not null default now()
);

create index if not exists idx_rd_knowledge_evidence on public.rd_external_knowledge(owner_id, evidence_level);

-- 9. 專家名單庫 (Expert Library)
create table if not exists public.rd_expert_profiles (
  id                uuid primary key default gen_random_uuid(),
  owner_id          uuid not null references public.profiles(id) on delete cascade,
  name              text not null,                       -- 專家姓名
  country           text not null default '',            -- 國家
  specialty         text not null default '',            -- 專長 (茶葉拼配, 咖啡萃取, 風味化學...)
  website_url       text not null default '',
  youtube_url       text not null default '',
  expertise_score   numeric default 5.0,                 -- 專業度 (1-5)
  reliability_score numeric default 5.0,                 -- 可信度 (1-5)
  notes             text not null default '',
  is_tracked        boolean default true,                -- 是否長期追蹤
  created_at        timestamptz not null default now()
);

-- 10. 保存期限研究庫 (Shelf-Life Test Studies)
create table if not exists public.rd_shelf_life_tests (
  id                uuid primary key default gen_random_uuid(),
  owner_id          uuid not null references public.profiles(id) on delete cascade,
  recipe_id         uuid references public.rd_recipes_v2(id) on delete set null,
  product_name      text not null default '',
  batch_code        text not null default '',
  storage_temp      text not null default '4°C 冷藏',
  days_checkpoint   int not null default 1,              -- 1, 3, 7, 14, 30, 60 天
  ph                numeric default 7.0,
  brix              numeric default 0,
  color             text not null default '正常',
  microbiology      text not null default '未檢出',      -- 微生物菌落檢驗
  taste             text not null default '正常風味',
  odor              text not null default '無異味',
  separation        text not null default '無分層',      -- 是否析水或油水分離
  texture           text not null default '均勻',
  status            text not null default 'pass',        -- pass | warning | fail
  created_at        timestamptz not null default now()
);

-- 11. 創新產品 Idea (Innovation Agent Engine)
create table if not exists public.rd_innovation_ideas (
  id                uuid primary key default gen_random_uuid(),
  owner_id          uuid not null references public.profiles(id) on delete cascade,
  title             text not null,                       -- 產品創意概念 (例: 芒果冷萃烏龍椰奶蓋)
  concept           text not null default '',            -- 概念故事與賣點
  recipe_concept    jsonb not null default '{}'::jsonb,  -- 建議配方架構
  flavor_pairing    text not null default '',            -- 風味搭配原理 (跨界技術)
  target_market     text not null default '越南夏季年輕白領',
  suggested_price   numeric default 42000,               -- 建議售價 VND
  estimated_cogs    numeric default 11500,               -- 預估成本 VND
  innovation_score  numeric default 85,                  -- 創新綜合評分 (1-100)
  novelty_score     numeric default 90,                  -- 新穎度
  feasibility_score numeric default 85,                  -- 技術可行性
  legal_risk_score  numeric default 10,                  -- 法規風險 (低風險)
  status            text not null default 'draft',       -- draft | experimenting | approved | rejected
  experiment_id     uuid references public.rd_experiments(id) on delete set null,
  created_at        timestamptz not null default now()
);

-- RLS 權限啟用
alter table public.rd_ingredients enable row level security;
alter table public.rd_recipes_v2 enable row level security;
alter table public.rd_recipe_ingredients enable row level security;
alter table public.rd_experiments enable row level security;
alter table public.rd_sensory_evaluations enable row level security;
alter table public.rd_competitor_products enable row level security;
alter table public.rd_external_knowledge enable row level security;
alter table public.rd_expert_profiles enable row level security;
alter table public.rd_shelf_life_tests enable row level security;
alter table public.rd_innovation_ideas enable row level security;

-- 通用 RLS Policies (Owner & Admin)
drop policy if exists "rd_ingredients_owner" on public.rd_ingredients;
create policy "rd_ingredients_owner" on public.rd_ingredients for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());
drop policy if exists "rd_ingredients_admin" on public.rd_ingredients;
create policy "rd_ingredients_admin" on public.rd_ingredients for all using (public.is_admin());

drop policy if exists "rd_recipes_v2_owner" on public.rd_recipes_v2;
create policy "rd_recipes_v2_owner" on public.rd_recipes_v2 for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());
drop policy if exists "rd_recipes_v2_admin" on public.rd_recipes_v2;
create policy "rd_recipes_v2_admin" on public.rd_recipes_v2 for all using (public.is_admin());

drop policy if exists "rd_experiments_owner" on public.rd_experiments;
create policy "rd_experiments_owner" on public.rd_experiments for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());
drop policy if exists "rd_experiments_admin" on public.rd_experiments;
create policy "rd_experiments_admin" on public.rd_experiments for all using (public.is_admin());

drop policy if exists "rd_sensory_owner" on public.rd_sensory_evaluations;
create policy "rd_sensory_owner" on public.rd_sensory_evaluations for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());
drop policy if exists "rd_sensory_admin" on public.rd_sensory_evaluations;
create policy "rd_sensory_admin" on public.rd_sensory_evaluations for all using (public.is_admin());

drop policy if exists "rd_competitor_owner" on public.rd_competitor_products;
create policy "rd_competitor_owner" on public.rd_competitor_products for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());
drop policy if exists "rd_competitor_admin" on public.rd_competitor_products;
create policy "rd_competitor_admin" on public.rd_competitor_products for all using (public.is_admin());

drop policy if exists "rd_knowledge_owner" on public.rd_external_knowledge;
create policy "rd_knowledge_owner" on public.rd_external_knowledge for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());
drop policy if exists "rd_knowledge_admin" on public.rd_external_knowledge;
create policy "rd_knowledge_admin" on public.rd_external_knowledge for all using (public.is_admin());

-- 預載常用食品添加物種子資料
insert into public.rd_food_additives (name, ins_number, function, max_usage, food_category, vietnam_status, taiwan_status, eu_status, us_status, regulatory_source)
values
  ('鹿角菜膠 (Carrageenan)', 'INS 407', '增稠劑 / 膠凝劑 / 奶蓋定型', 'GMP (適量使用)', '乳飲品、奶蓋類', '允許使用', '允許使用', 'Approved (E407)', 'GRAS', 'Thông tư 24/2019/TT-BYT'),
  ('黃原膠 (Xanthan Gum)', 'INS 415', '增稠劑 / 懸浮安定劑 / 防析水', 'GMP (適量使用)', '果汁、糖漿、冰沙', '允許使用', '允許使用', 'Approved (E415)', 'GRAS', 'Thông tư 24/2019/TT-BYT'),
  ('檸檬酸 (Citric Acid)', 'INS 330', '酸度調節劑 / 風味提鮮 / 抑菌', 'GMP (適量使用)', '水果茶、氣泡飲', '允許使用', '允許使用', 'Approved (E330)', 'GRAS', 'Thông tư 24/2019/TT-BYT'),
  ('羧甲基纖維素鈉 (CMC)', 'INS 466', '乳化增稠劑 / 奶茶滑順度', 'GMP (適量使用)', '奶茶、調味乳', '允許使用', '允許使用', 'Approved (E466)', 'GRAS', 'Thông tư 24/2019/TT-BYT'),
  ('三氯蔗糖 (Sucralose)', 'INS 955', '甜味劑 (高倍甜味無熱量)', '300 mg/kg', '低卡茶飲、代糖配方', '限制用量使用', '限制用量使用', 'Approved (E955)', 'Approved', 'Thông tư 24/2019/TT-BYT'),
  ('山梨酸鉀 (Potassium Sorbate)', 'INS 202', '防腐劑 / 延長糖漿與果醬效期', '1000 mg/kg', '常溫糖漿、果泥', '嚴格限量使用', '限制用量使用', 'Approved (E202)', 'GRAS', 'Thông tư 24/2019/TT-BYT')
on conflict do nothing;
