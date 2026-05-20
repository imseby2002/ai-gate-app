-- ============================================================
-- 023: 民宿基本資料 (bnb_profiles)
-- ============================================================

create table if not exists bnb_profiles (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users(id) on delete cascade,
  name             text not null,
  description      text,
  address          text,
  city             text,
  phone            text,
  email            text,
  website          text,
  line_id          text,
  check_in_time    text not null default '15:00',
  check_out_time   text not null default '11:00',
  min_nights       int  not null default 1,
  amenities        jsonb default '[]',
  house_rules      text,
  images           jsonb default '[]',
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (user_id)
);

alter table bnb_profiles enable row level security;
create policy "bnb_profiles: owner" on bnb_profiles for all using (auth.uid() = user_id);

-- properties 表改為「房型」，加上 room_type 欄位
alter table properties add column if not exists room_type text;
alter table properties add column if not exists floor     text;
alter table properties add column if not exists area_sqm  numeric(6,1);
