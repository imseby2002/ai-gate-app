-- ============================================================
-- 026: 日曆定價系統 (room_date_settings / pricing_rules)
-- ============================================================

-- 為 properties 新增動態定價開關
alter table properties add column if not exists dynamic_pricing_enabled boolean not null default false;

-- 每日每房型設定（狀態 + 覆蓋價格）
create table if not exists room_date_settings (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  property_id     uuid not null references properties(id) on delete cascade,
  date            date not null,
  booking_status  text not null default 'open'
                    check (booking_status in ('open','closed','admin_only')),
  price_override  numeric(10,2),
  notes           text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (user_id, property_id, date)
);

-- 動態浮動定價規則
create table if not exists pricing_rules (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references auth.users(id) on delete cascade,
  property_id       uuid references properties(id) on delete cascade, -- null = 全部房型
  name              text not null,
  rule_type         text not null
                      check (rule_type in ('weekend','holiday','seasonal','occupancy','advance_booking')),
  enabled           boolean not null default true,
  adjustment_type   text not null default 'percent'
                      check (adjustment_type in ('percent','fixed')),
  adjustment_value  numeric(10,2) not null default 0,
  conditions        jsonb default '{}',
  priority          int not null default 0,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

-- ── RLS ──────────────────────────────────────────────────────
alter table room_date_settings enable row level security;
alter table pricing_rules       enable row level security;

create policy "room_date_settings: owner" on room_date_settings for all using (auth.uid() = user_id);
create policy "pricing_rules: owner"      on pricing_rules       for all using (auth.uid() = user_id);

-- ── Indexes ──────────────────────────────────────────────────
create index if not exists room_date_settings_property_date on room_date_settings(property_id, date);
create index if not exists room_date_settings_user_date     on room_date_settings(user_id, date);
create index if not exists pricing_rules_user               on pricing_rules(user_id, enabled);
