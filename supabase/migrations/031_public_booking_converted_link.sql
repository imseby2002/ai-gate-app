-- 031: public_bookings 記錄已轉成的正式訂單，避免重複轉單
alter table public_bookings
  add column if not exists converted_booking_id uuid references bookings(id) on delete set null;
