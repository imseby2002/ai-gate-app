-- 每日入住(bnb_daily_records)跟訂單(bookings)之間原本沒有真正的關聯欄位，只能靠
-- 「單號+房型」或「房型+日期唯一一筆」這種軟比對去猜對應到哪張訂單，猜不到就靜默
-- 跳過，導致在每日入住/訂單/日曆三處手動輸入時常常沒辦法互相同步。加上這個直接關聯，
-- 讓三處的讀寫都能用同一個 id 精準對應，不必再猜。
alter table public.bnb_daily_records
  add column if not exists booking_id uuid references public.bookings(id) on delete set null;

create index if not exists idx_bnb_daily_records_booking_id
  on public.bnb_daily_records(booking_id);

-- 回填既有資料：用原本的軟比對規則（單號+房型精準比對；沒單號則房型+日期涵蓋範圍
-- 剛好唯一一筆）幫舊資料先建好關聯，之後新的讀寫邏輯才有 booking_id 可以直接用。
update public.bnb_daily_records d
set booking_id = b.id
from public.bookings b, public.properties p
where d.booking_id is null
  and d.order_number is not null
  and p.user_id = d.user_id and p.name = d.room_name
  and b.user_id = d.user_id
  and b.property_id = p.id
  and b.platform_booking_id = d.order_number
  and b.status <> 'cancelled';

update public.bnb_daily_records d
set booking_id = only_match.id
from (
  select b.id, b.user_id, b.property_id, b.check_in, b.check_out
  from public.bookings b
  where b.status <> 'cancelled'
) only_match, public.properties p
where d.booking_id is null
  and d.order_number is null
  and d.source = 'booking'
  and p.user_id = only_match.user_id and p.id = only_match.property_id
  and p.name = d.room_name
  and d.user_id = only_match.user_id
  and d.date >= only_match.check_in and d.date < only_match.check_out
  and (
    select count(*) from public.bookings b2
    where b2.user_id = d.user_id and b2.property_id = only_match.property_id
      and b2.status <> 'cancelled'
      and d.date >= b2.check_in and d.date < b2.check_out
  ) = 1;
