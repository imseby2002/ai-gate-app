-- 總經理室 P2：AI 經營快報（每日／每週／月度）
create table if not exists gm_reports (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null,
  kind text not null default 'daily',       -- daily | weekly | monthly
  report_date date not null,                 -- 報告基準日（台北時區）
  title text not null default '',
  content text not null default '',          -- AI 摘要（純文字/Markdown）
  snapshot jsonb,                            -- 當時彙整快照
  channels text not null default '',         -- 已推播管道，如 "站內,telegram,email"
  created_at timestamptz not null default now()
);
create index if not exists gm_reports_owner_idx on gm_reports(owner_id, kind, report_date desc);
create unique index if not exists gm_reports_unique_idx on gm_reports(owner_id, kind, report_date);
alter table gm_reports enable row level security;
create policy gm_reports_admin on gm_reports for all using (is_admin());
create policy gm_reports_owner on gm_reports for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());
