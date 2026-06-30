-- 門市月度業績報表（損益表 P&L）：門市 × 月份 × 科目
-- 來源：辦公室從 POS 報表彙整的 Excel，整張表 CSV 匯入；科目樹寫死於程式碼

-- 門市清單（含倉庫 kho、辦公室、彙總群組）
create table if not exists public.pnl_stores (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  code text not null,                      -- 短碼（英／越文，匯入比對用）BACH_MAI...
  name text not null,                      -- 顯示名
  name_vi text not null default '',        -- 越南文原名
  kind text not null default 'store' check (kind in ('store','warehouse','office','group')),
  sort int not null default 0,
  archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_id, code)
);

alter table public.pnl_stores enable row level security;
drop policy if exists "own pnl_stores" on public.pnl_stores;
create policy "own pnl_stores" on public.pnl_stores
  for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);
create index if not exists pnl_stores_owner_idx on public.pnl_stores(owner_id);

-- 損益表格值：一格一筆（store × period × line_code）
create table if not exists public.pnl_entries (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  store_id uuid not null references public.pnl_stores(id) on delete cascade,
  period text not null,                    -- 'YYYY-MM'
  line_code text not null,                 -- 對應 pnl-schema.ts 的科目碼
  amount numeric not null default 0,
  source text not null default 'manual' check (source in ('manual','import','cashflow')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_id, store_id, period, line_code)
);

alter table public.pnl_entries enable row level security;
drop policy if exists "own pnl_entries" on public.pnl_entries;
create policy "own pnl_entries" on public.pnl_entries
  for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);
create index if not exists pnl_entries_lookup_idx on public.pnl_entries(owner_id, period);
create index if not exists pnl_entries_store_idx on public.pnl_entries(store_id);

-- 維修費用明細：逐筆登記＋分攤月數，回填損益表 repair 行
create table if not exists public.pnl_repairs (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  store_id uuid not null references public.pnl_stores(id) on delete cascade,
  period text not null,                    -- 發生月 'YYYY-MM'
  item text not null,                      -- 項目名稱
  amount numeric not null default 0,       -- 總額
  amort_months int not null default 1,     -- 分攤月數（7年=84、12月=12...）
  start_period text not null default '',   -- 分攤起始月，空=發生月
  note text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.pnl_repairs enable row level security;
drop policy if exists "own pnl_repairs" on public.pnl_repairs;
create policy "own pnl_repairs" on public.pnl_repairs
  for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);
create index if not exists pnl_repairs_lookup_idx on public.pnl_repairs(owner_id, store_id, period);
