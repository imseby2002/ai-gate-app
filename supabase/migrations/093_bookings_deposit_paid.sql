-- 訂單新增訂金／付款狀態欄位，讓每日入住的「訂金/已付款」編輯可以雙向同步回訂單本身，
-- 訂單詳情頁也能看到/編輯同一份資料。
alter table public.bookings
  add column if not exists deposit_amount numeric(10,2),
  add column if not exists is_paid boolean not null default false;
