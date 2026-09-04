-- 維修單位 P1：設備資產台帳
create table if not exists repair_equipment (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null,
  store text not null default '',          -- 所屬門市（空＝總部/共用）
  category text not null default '',       -- 設備類別（製冰機/封口機/POS…）
  name text not null,                      -- 設備名稱
  brand_model text not null default '',    -- 品牌型號
  serial_no text not null default '',      -- 序號/財產編號
  purchase_date date,                      -- 購入日
  warranty_until date,                     -- 保固到期日
  location text not null default '',       -- 擺放位置
  status text not null default 'active',   -- active 使用中 | repairing 維修中 | scrapped 已報廢
  note text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists repair_equipment_owner_idx on repair_equipment(owner_id, store);
create index if not exists repair_equipment_warranty_idx on repair_equipment(owner_id, warranty_until);
alter table repair_equipment enable row level security;
create policy repair_equipment_admin on repair_equipment for all using (is_admin());
create policy repair_equipment_owner on repair_equipment for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());
