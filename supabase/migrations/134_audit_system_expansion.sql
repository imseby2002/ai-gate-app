-- =============================================
-- AI GATE - Migration 134
-- 稽核專家 AI、稽核日誌、知識庫、六大現場巡檢模組（含公務機與 Jetson 串接預留）
-- =============================================

-- 1. 稽核專用知識庫（流程、動線、人體工學、SOP、罰則等補充訓練資料）
create table if not exists public.audit_knowledge (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null,
  kind text not null default 'sop', -- sop | ergonomics | hygiene | rules | other
  title text not null,
  content text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_audit_knowledge_owner on public.audit_knowledge(owner_id, kind);
alter table public.audit_knowledge enable row level security;
create policy audit_knowledge_admin on public.audit_knowledge for all using (is_admin());
create policy audit_knowledge_owner on public.audit_knowledge for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());

-- 2. 擴充 audit_chats 與 audit_messages 支援模式 (discuss/guide) 與建議答案區
alter table public.audit_chats
  add column if not exists mode text not null default 'discuss';

alter table public.audit_messages
  add column if not exists suggestion text not null default '',
  add column if not exists photo_url text not null default '';

-- 3. 稽核日誌（由討論或現場巡檢自動摘要）
create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null,
  chat_id uuid references public.audit_chats(id) on delete set null,
  store text not null default '',
  title text not null default '',
  summary text not null default '',
  upto_count int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_audit_logs_owner on public.audit_logs(owner_id, created_at desc);
alter table public.audit_logs enable row level security;
create policy audit_logs_admin on public.audit_logs for all using (is_admin());
create policy audit_logs_owner on public.audit_logs for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());

-- 4. 門市專屬公務機管理（行銷、Zalo 客服、防飛單與私收款）
create table if not exists public.audit_official_devices (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null,
  store text not null,
  device_name text not null default '門市公務機',
  serial_number text not null default '',
  zalo_account text not null default '',
  official_bank_qr text not null default '',
  status text not null default 'active', -- active | repairing | missing | uninspected
  last_inspected_at timestamptz,
  last_inspector text not null default '',
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_audit_devices_store on public.audit_official_devices(owner_id, store);
alter table public.audit_official_devices enable row level security;
create policy audit_devices_admin on public.audit_official_devices for all using (is_admin());
create policy audit_devices_owner on public.audit_official_devices for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());

-- 5. 門市現場巡檢單（環境衛生、服務微笑、食品品質、原料安全、缺補料、行銷公務機）
create table if not exists public.audit_inspections (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null,
  store text not null,
  auditor_name text not null default '',
  status text not null default 'in_progress', -- in_progress | completed | needs_rectification
  overall_score numeric not null default 100,
  inspection_date date not null default current_date,
  summary text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_audit_inspections_store on public.audit_inspections(owner_id, store, inspection_date desc);
alter table public.audit_inspections enable row level security;
create policy audit_inspections_admin on public.audit_inspections for all using (is_admin());
create policy audit_inspections_owner on public.audit_inspections for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());

-- 6. 巡檢細項（拍照、手寫筆記、AI 多模態分析評語、客觀測量數值、罰則申報）
create table if not exists public.audit_inspection_items (
  id uuid primary key default gen_random_uuid(),
  inspection_id uuid not null references public.audit_inspections(id) on delete cascade,
  owner_id uuid not null,
  category text not null, -- hygiene | attitude | food_quality | safety_scrap | shortage | marketing_zalo
  item_title text not null,
  score numeric not null default 10,
  photos text[] not null default '{}',
  handwritten_notes text not null default '',
  ai_analysis text not null default '',
  objective_metrics jsonb not null default '{}'::jsonb,
  penalty_flag boolean not null default false,
  penalty_reason text not null default '',
  created_at timestamptz not null default now()
);
create index if not exists idx_audit_insp_items_cat on public.audit_inspection_items(inspection_id, category);
alter table public.audit_inspection_items enable row level security;
create policy audit_insp_items_admin on public.audit_inspection_items for all using (is_admin());
create policy audit_insp_items_owner on public.audit_inspection_items for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());

-- 7. 行銷活動與直播事前登記白名單
create table if not exists public.audit_marketing_events (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null,
  store text not null,
  event_title text not null,
  platform text not null default 'zalo', -- zalo | tiktok | facebook
  host_account text not null default '',
  start_time timestamptz,
  end_time timestamptz,
  approved boolean not null default true,
  pos_reconciled boolean not null default false,
  notes text not null default '',
  created_at timestamptz not null default now()
);
create index if not exists idx_audit_mkt_store on public.audit_marketing_events(owner_id, store);
alter table public.audit_marketing_events enable row level security;
create policy audit_mkt_admin on public.audit_marketing_events for all using (is_admin());
create policy audit_mkt_owner on public.audit_marketing_events for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());
