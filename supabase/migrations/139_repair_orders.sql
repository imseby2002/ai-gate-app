-- 維修單位 P2：報修單／工單
create table if not exists repair_orders (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null,
  store text not null default '',                 -- 報修門市
  equipment_id uuid references repair_equipment(id) on delete set null,  -- 關聯設備（可空）
  equipment_name text not null default '',        -- 設備名稱快照
  title text not null,                            -- 問題標題
  description text not null default '',           -- 詳細描述
  priority text not null default 'normal',        -- low | normal | high | urgent
  status text not null default 'reported',        -- reported 待處理 | assigned 已派工 | in_progress 處理中 | done 已完成 | cancelled 已取消
  reported_by uuid,                               -- 報修人 user id
  reporter_name text not null default '',
  assignee_type text not null default '',         -- vendor | employee | ''
  assignee_id text not null default '',           -- fin_vendors.id 或 hr_employees.id
  assignee_name text not null default '',         -- 執行者名稱快照
  cost numeric not null default 0,                -- 維修費用（先只記錄）
  resolution text not null default '',            -- 處理結果／備註
  reported_at timestamptz not null default now(),
  assigned_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists repair_orders_owner_idx on repair_orders(owner_id, status, reported_at desc);
create index if not exists repair_orders_store_idx on repair_orders(owner_id, store);
create index if not exists repair_orders_equipment_idx on repair_orders(equipment_id);
alter table repair_orders enable row level security;
create policy repair_orders_admin on repair_orders for all using (is_admin());
create policy repair_orders_owner on repair_orders for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());
