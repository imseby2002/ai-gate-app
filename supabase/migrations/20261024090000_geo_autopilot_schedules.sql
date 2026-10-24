-- GEO 自動巡航排程（每間公司一組；僅 service-role 透過 API 存取）
create table if not exists public.geo_autopilot_schedules (
  owner_id uuid primary key,
  created_by uuid not null,
  enabled boolean not null default false,
  frequency text not null default 'weekly' check (frequency in ('daily','weekly')),
  weekdays int[] not null default '{1}',
  run_hour int not null default 9 check (run_hour between 0 and 23),
  timezone text not null default 'Asia/Ho_Chi_Minh',
  locale text not null default 'zh-TW',
  topics text[] not null default '{}',
  auto_topics boolean not null default true,
  last_run_date date,
  last_run_at timestamptz,
  last_status text,
  last_project_id uuid,
  updated_at timestamptz not null default now()
);
alter table public.geo_autopilot_schedules enable row level security;
alter table public.geo_autopilot_schedules add column if not exists promo_focus text not null default '';
