-- 門市：原料進貨批次＋到期，及節慶／日期區間的可變安全量・滿倉量。

-- 進貨批次與到期
create table if not exists inv_material_batches (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null,
  store text not null,
  material_code text not null,
  material_name text not null default '',
  unit text not null default '',
  purchase_date date,
  expiry_date date not null,
  qty numeric not null default 0,
  remind_staff int,   -- 到期前 N 天通知門市人員與管理（null＝用 inv_settings 預設）
  remind_audit int,   -- 到期前 N 天通知管理與稽核
  remind_mgmt int,    -- 到期前 N 天通知管理
  status text not null default 'active',  -- active | scrapped | cleared
  scrapped_at timestamptz,
  notified_stage int not null default 0,  -- 已發送到哪個通知階段（去重）
  note text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists inv_material_batches_owner_store_idx on inv_material_batches(owner_id, store);
create index if not exists inv_material_batches_expiry_idx on inv_material_batches(owner_id, expiry_date) where status = 'active';
alter table inv_material_batches enable row level security;
create policy inv_material_batches_admin on inv_material_batches for all using (is_admin());
create policy inv_material_batches_owner on inv_material_batches for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());

-- 可變安全量／滿倉量（節慶日期區間覆寫）
create table if not exists inv_safety_overrides (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null,
  store text not null,
  material_code text not null,
  label text not null default '',
  start_date date not null,
  end_date date not null,
  safety_qty numeric not null default 0,
  full_qty numeric not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists inv_safety_overrides_lookup_idx on inv_safety_overrides(owner_id, store, material_code);
alter table inv_safety_overrides enable row level security;
create policy inv_safety_overrides_admin on inv_safety_overrides for all using (is_admin());
create policy inv_safety_overrides_owner on inv_safety_overrides for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());

-- 到期通知預設天數（單位層級；批次可各自覆寫）
alter table inv_settings add column if not exists expiry_remind_staff int not null default 7;
alter table inv_settings add column if not exists expiry_remind_audit int not null default 3;
alter table inv_settings add column if not exists expiry_remind_mgmt int not null default 1;
