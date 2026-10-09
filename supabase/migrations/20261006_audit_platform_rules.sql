-- =============================================
-- AI GATE - Migration 20261006 (audit platform rules)
-- 稽核平台規則庫：20260910 的資料表從未建立，改以公司（owner_id）隔離重新定義。
-- 僅 service_role（API 端 admin client）存取。
-- =============================================

create table if not exists public.audit_rules_v2 (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null,
  rule_code text not null,                               -- RULE-0001
  title text not null,
  status text not null default 'hypothesis',             -- hypothesis | suggested | approved | hard_rule
  category text not null default 'material',
  target_product text not null default '全品項',
  condition_desc text not null default '',
  adjustment_type text not null default 'tea_adjustment',
  adjustment_value text not null default '',
  numerical_delta numeric not null default 0,
  unit text not null default 'ml',
  version text not null default 'V1',
  effective_from date not null default current_date,
  effective_to date,
  approved_by text,
  hypothesis_reason text not null default '',
  confidence integer not null default 80,
  store text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_id, rule_code)
);
create index if not exists idx_audit_rules_v2_owner on public.audit_rules_v2(owner_id, created_at desc);
alter table public.audit_rules_v2 enable row level security;

create table if not exists public.audit_rule_versions (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null,
  rule_id uuid not null references public.audit_rules_v2(id) on delete cascade,
  rule_code text not null,
  version text not null,
  status text not null,
  adjustment_value text not null default '',
  numerical_delta numeric not null default 0,
  effective_from date not null default current_date,
  effective_to date,
  approved_by text not null default '',
  change_note text not null default '',
  created_at timestamptz not null default now()
);
create index if not exists idx_audit_rule_versions_rule on public.audit_rule_versions(rule_id);
alter table public.audit_rule_versions enable row level security;

notify pgrst, 'reload schema';
