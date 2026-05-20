-- ============================================================
-- 025: 訂單補充欄位 (旅客詳細資料 + 付款類型 + 抵達時間)
-- ============================================================

alter table bookings add column if not exists guest_gender    text;
alter table bookings add column if not exists guest_birthday  date;
alter table bookings add column if not exists guest_id_number text;
alter table bookings add column if not exists guest_address   text;
alter table bookings add column if not exists payment_type    text default 'channel'
  check (payment_type in ('channel','direct','unpaid'));
alter table bookings add column if not exists arrival_time    text;
