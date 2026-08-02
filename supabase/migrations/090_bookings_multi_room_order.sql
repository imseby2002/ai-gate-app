-- 支援「一張訂單、多個房型」（同一封 OTA 確認信同時訂了不同房型）：
-- 把 (user_id, platform, platform_booking_id) 的唯一限制放寬成再加上 property_id，
-- 讓同一張訂單可以拆成多筆 bookings（每個房型一筆）。
-- 舊限制的資料集合本來就滿足新限制（欄位變多只會更寬鬆），不需要清資料。
-- 用 NULLS NOT DISTINCT：房型比對失敗（property_id 為 null）時，同一張訂單重複同步
-- 仍視為同一筆（避免每次重新整理都多出一筆房型未定的重複訂單）。
alter table public.bookings
  drop constraint if exists bookings_user_id_platform_platform_booking_id_key;

alter table public.bookings
  add constraint bookings_user_id_platform_platform_booking_id_property_id_key
  unique nulls not distinct (user_id, platform, platform_booking_id, property_id);
