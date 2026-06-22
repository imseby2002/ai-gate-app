-- ============================================================
-- 051: Google Hotel Center (Free Booking Links) feed 支援
-- 民宿座標、國別與啟用開關，供 /api/book/[slug]/google/* feed 使用
-- ============================================================

alter table bnb_profiles
  add column if not exists latitude            numeric(9,6),
  add column if not exists longitude           numeric(9,6),
  add column if not exists country             text default 'TW',
  add column if not exists google_feed_enabled boolean not null default false;
