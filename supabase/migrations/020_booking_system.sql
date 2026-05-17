-- ============================================================
-- 020: 訂房系統 (properties / bookings / ical_settings / blocked_dates)
-- ============================================================

-- 房源/房型
create table if not exists properties (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  name          text not null,
  description   text,
  room_count    int  not null default 1,
  max_guests    int  not null default 2,
  base_price    numeric(10,2),
  currency      text not null default 'TWD',
  amenities     jsonb default '[]',
  images        jsonb default '[]',
  status        text not null default 'active' check (status in ('active','inactive')),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- 訂單（來自各平台 or 手動）
create table if not exists bookings (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null references auth.users(id) on delete cascade,
  property_id         uuid references properties(id) on delete set null,
  platform            text not null default 'manual',
  -- platform 可為 'manual','direct','booking_com','agoda','airbnb','trip_com','asiayo','easytravel'
  platform_booking_id text,
  guest_name          text,
  guest_email         text,
  guest_phone         text,
  check_in            date not null,
  check_out           date not null,
  num_guests          int  not null default 1,
  total_price         numeric(10,2),
  currency            text default 'TWD',
  status              text not null default 'confirmed'
                        check (status in ('pending','confirmed','cancelled','completed','no_show')),
  special_requests    text,
  notes               text,
  source              text default 'manual', -- 'ical','email','manual','form'
  raw_data            jsonb,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  unique (user_id, platform, platform_booking_id)
);

-- iCal 同步設定（每個平台一筆）
create table if not exists ical_settings (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  property_id     uuid references properties(id) on delete cascade,
  platform        text not null, -- 'booking_com','agoda','airbnb','trip_com','asiayo','easytravel','other'
  platform_name   text,
  ical_url        text not null,
  sync_enabled    boolean not null default true,
  sync_interval   int  not null default 60, -- 分鐘
  last_synced_at  timestamptz,
  last_sync_count int,
  last_sync_error text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- 封鎖日期（由 iCal 解析產生）
create table if not exists blocked_dates (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  property_id     uuid references properties(id) on delete cascade,
  booking_id      uuid references bookings(id) on delete cascade,
  ical_setting_id uuid references ical_settings(id) on delete cascade,
  date            date not null,
  platform        text,
  reason          text default 'booking', -- 'booking','maintenance','owner_block'
  created_at      timestamptz not null default now(),
  unique (user_id, property_id, date, ical_setting_id)
);

-- ── RLS ──────────────────────────────────────────────────────
alter table properties     enable row level security;
alter table bookings       enable row level security;
alter table ical_settings  enable row level security;
alter table blocked_dates  enable row level security;

create policy "properties: owner"    on properties    for all using (auth.uid() = user_id);
create policy "bookings: owner"      on bookings      for all using (auth.uid() = user_id);
create policy "ical_settings: owner" on ical_settings for all using (auth.uid() = user_id);
create policy "blocked_dates: owner" on blocked_dates for all using (auth.uid() = user_id);

-- ── Indexes ──────────────────────────────────────────────────
create index if not exists bookings_user_checkin     on bookings(user_id, check_in);
create index if not exists bookings_property_checkin on bookings(property_id, check_in);
create index if not exists bookings_platform_id      on bookings(user_id, platform, platform_booking_id);
create index if not exists blocked_dates_property    on blocked_dates(property_id, date);
create index if not exists ical_settings_user        on ical_settings(user_id, sync_enabled);
