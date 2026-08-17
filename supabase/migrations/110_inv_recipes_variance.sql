-- =============================================
-- AI GATE - Migration 110
-- 門市報表（階段 2）：配方(BOM) + 成品對照 + 差異分析設定。
-- 配方：每個成品用多少原料/杯 → 理論用量；對照：POS 成品碼 → 配方。
-- 差異＝實際出庫 − 理論用量；誤差% 超過門檻警示（人員可設門檻）。
-- =============================================

create table if not exists public.inv_settings (
  owner_id           uuid primary key references public.profiles(id) on delete cascade,
  variance_threshold numeric not null default 10,   -- 誤差警示門檻（%）
  updated_at         timestamptz not null default now()
);

-- 配方（成品）
create table if not exists public.inv_recipes (
  id         uuid primary key default gen_random_uuid(),
  owner_id   uuid not null references public.profiles(id) on delete cascade,
  name       text not null,
  note       text not null default '',
  created_at timestamptz not null default now()
);
create index if not exists idx_inv_recipes_owner on public.inv_recipes(owner_id);

-- 配方項目（每杯用多少原料）
create table if not exists public.inv_recipe_items (
  id            uuid primary key default gen_random_uuid(),
  recipe_id     uuid not null references public.inv_recipes(id) on delete cascade,
  owner_id      uuid not null references public.profiles(id) on delete cascade,
  material_code text not null,
  material_name text not null default '',
  qty_per_cup   numeric not null default 0   -- 每杯用量（單位同進銷存）
);
create index if not exists idx_inv_recipe_items_recipe on public.inv_recipe_items(recipe_id);

-- POS 成品 → 配方 對照
create table if not exists public.inv_product_map (
  id           uuid primary key default gen_random_uuid(),
  owner_id     uuid not null references public.profiles(id) on delete cascade,
  product_code text not null,
  product_name text not null default '',
  recipe_id    uuid references public.inv_recipes(id) on delete set null,
  unique (owner_id, product_code)
);

alter table public.inv_settings enable row level security;
alter table public.inv_recipes enable row level security;
alter table public.inv_recipe_items enable row level security;
alter table public.inv_product_map enable row level security;

drop policy if exists "inv_settings_owner" on public.inv_settings;
create policy "inv_settings_owner" on public.inv_settings for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());
drop policy if exists "inv_settings_admin" on public.inv_settings;
create policy "inv_settings_admin" on public.inv_settings for all using (public.is_admin());

drop policy if exists "inv_recipes_owner" on public.inv_recipes;
create policy "inv_recipes_owner" on public.inv_recipes for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());
drop policy if exists "inv_recipes_admin" on public.inv_recipes;
create policy "inv_recipes_admin" on public.inv_recipes for all using (public.is_admin());

drop policy if exists "inv_recipe_items_owner" on public.inv_recipe_items;
create policy "inv_recipe_items_owner" on public.inv_recipe_items for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());
drop policy if exists "inv_recipe_items_admin" on public.inv_recipe_items;
create policy "inv_recipe_items_admin" on public.inv_recipe_items for all using (public.is_admin());

drop policy if exists "inv_product_map_owner" on public.inv_product_map;
create policy "inv_product_map_owner" on public.inv_product_map for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());
drop policy if exists "inv_product_map_admin" on public.inv_product_map;
create policy "inv_product_map_admin" on public.inv_product_map for all using (public.is_admin());
