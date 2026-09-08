-- 放寬 bookings 的唯一鍵限制：
-- 只有在 platform_booking_id 不為空時才要求 (user_id, platform, platform_booking_id, property_id) 唯一。
-- 避免手動訂單（platform_booking_id 為 null）因 NULLS NOT DISTINCT 導致同一房型只能建立一筆無單號訂單。
alter table public.bookings
  drop constraint if exists bookings_user_id_platform_platform_booking_id_property_id_key;

create unique index if not exists bookings_user_platform_pbid_property_key
  on public.bookings (user_id, platform, platform_booking_id, property_id)
  nulls not distinct
  where platform_booking_id is not null;
