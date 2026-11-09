-- 預約系統：簡訊提醒設定與發送紀錄
alter table public.reserve_stores
  add column if not exists sms_reminder_enabled boolean not null default false,
  add column if not exists sms_reminder_hours integer not null default 24,
  add column if not exists sms_reminder_template text;

create table if not exists public.reserve_sms_reminders (
  id uuid primary key default gen_random_uuid(),
  appointment_id uuid not null references public.reserve_appointments(id) on delete cascade,
  store_id uuid not null references public.reserve_stores(id) on delete cascade,
  phone text not null,
  status text not null default 'sent', -- sent | failed | skipped
  provider text,
  error text,
  cost_usd numeric(10,4) not null default 0,
  created_at timestamptz not null default now(),
  unique (appointment_id)
);

create index if not exists reserve_sms_reminders_store_idx on public.reserve_sms_reminders(store_id, created_at desc);

alter table public.reserve_sms_reminders enable row level security;

drop policy if exists "store owner reads sms reminders" on public.reserve_sms_reminders;
create policy "store owner reads sms reminders" on public.reserve_sms_reminders
  for select using (exists (
    select 1 from public.reserve_stores s where s.id = store_id and s.user_id = auth.uid()
  ));
