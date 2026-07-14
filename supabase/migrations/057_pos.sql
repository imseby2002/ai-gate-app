-- 門市點單系統：一店一終端、全域/門市專屬菜單、離線同步

-- 菜單版本（每位 owner 一筆，任何菜單異動 +1）
create table if not exists public.pos_menu_meta (
  owner_id uuid primary key references public.profiles(id) on delete cascade,
  revision bigint not null default 1,
  updated_at timestamptz not null default now()
);

-- 門市
create table if not exists public.pos_stores (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  slug text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (owner_id, slug)
);
create index if not exists pos_stores_owner_idx on public.pos_stores (owner_id);

-- 終端（一店一終端）
create table if not exists public.pos_terminals (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null unique references public.pos_stores(id) on delete cascade,
  owner_id uuid not null references public.profiles(id) on delete cascade,
  name text not null default '櫃台',
  device_key text not null unique default encode(gen_random_bytes(24), 'hex'),
  last_sync_at timestamptz,
  last_menu_revision bigint not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists pos_terminals_owner_idx on public.pos_terminals (owner_id);

-- 分類（store_id null = 全域；有值 = 僅該門市）
create table if not exists public.pos_categories (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  store_id uuid references public.pos_stores(id) on delete cascade,
  name text not null,
  sort_order int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists pos_categories_owner_idx on public.pos_categories (owner_id, sort_order);

-- 品項
create table if not exists public.pos_items (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  category_id uuid not null references public.pos_categories(id) on delete cascade,
  store_id uuid references public.pos_stores(id) on delete cascade,
  name text not null,
  description text not null default '',
  price_cents int not null default 0,
  barcode text,
  image_url text,
  modifiers jsonb not null default '[]',
  sort_order int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists pos_items_category_idx on public.pos_items (category_id, sort_order);
create index if not exists pos_items_barcode_idx on public.pos_items (owner_id, barcode) where barcode is not null;

-- 訂單（client_id 供離線冪等上傳）
create table if not exists public.pos_orders (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  store_id uuid not null references public.pos_stores(id) on delete cascade,
  terminal_id uuid not null references public.pos_terminals(id) on delete cascade,
  client_id uuid not null,
  order_no text not null,
  order_type text not null default 'dine_in', -- dine_in | takeout | delivery
  table_label text,
  status text not null default 'pending', -- pending | preparing | ready | done | cancelled
  items jsonb not null default '[]',
  note text not null default '',
  subtotal_cents int not null default 0,
  total_cents int not null default 0,
  menu_revision bigint,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (terminal_id, client_id)
);
create index if not exists pos_orders_store_created_idx on public.pos_orders (store_id, created_at desc);
create index if not exists pos_orders_owner_status_idx on public.pos_orders (owner_id, status, created_at desc);

--  bump 菜單版本
create or replace function public.bump_pos_menu_revision(p_owner uuid)
returns bigint language plpgsql security definer as $$
declare v_rev bigint;
begin
  insert into public.pos_menu_meta (owner_id, revision, updated_at)
  values (p_owner, 2, now())
  on conflict (owner_id) do update
    set revision = public.pos_menu_meta.revision + 1,
        updated_at = now()
  returning revision into v_rev;
  return v_rev;
end;
$$;

-- RLS
alter table public.pos_menu_meta enable row level security;
alter table public.pos_stores enable row level security;
alter table public.pos_terminals enable row level security;
alter table public.pos_categories enable row level security;
alter table public.pos_items enable row level security;
alter table public.pos_orders enable row level security;

create policy "pos_menu_meta owner" on public.pos_menu_meta
  for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

create policy "pos_stores owner" on public.pos_stores
  for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

create policy "pos_terminals owner" on public.pos_terminals
  for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

create policy "pos_categories owner" on public.pos_categories
  for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

create policy "pos_items owner" on public.pos_items
  for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

create policy "pos_orders owner" on public.pos_orders
  for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

-- Realtime：菜單與訂單雲端編輯 → 終端同步
alter publication supabase_realtime add table public.pos_categories;
alter publication supabase_realtime add table public.pos_items;
alter publication supabase_realtime add table public.pos_orders;
