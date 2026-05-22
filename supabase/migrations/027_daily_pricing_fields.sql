-- 027: 每日詳細定價欄位（訂金、加人價、加大/小床）
alter table room_date_settings
  add column if not exists deposit          numeric(10,2),
  add column if not exists extra_person_fee numeric(10,2),
  add column if not exists extra_large_bed  numeric(10,2),
  add column if not exists extra_small_bed  numeric(10,2);
