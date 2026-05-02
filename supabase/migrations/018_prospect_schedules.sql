-- 潛在客戶行銷 定時排程設定
create table if not exists prospect_schedules (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references auth.users(id) on delete cascade not null unique,
  config      jsonb not null default '{}',   -- 完整 ProspectConfig
  schedule    jsonb not null default '{}',   -- { enabled, frequency, hour, minute, weekday, monthDay, nextRunAt, lastRunAt }
  last_result jsonb,                         -- { orgs, summary, runAt }
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

alter table prospect_schedules enable row level security;

create policy "owner access" on prospect_schedules
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create or replace function update_prospect_schedules_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;

create trigger trg_prospect_schedules_updated_at
  before update on prospect_schedules
  for each row execute function update_prospect_schedules_updated_at();
