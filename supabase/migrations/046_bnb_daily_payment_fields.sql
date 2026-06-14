-- 每日入住：新增費用/支付欄位
-- price_total 實際訂房價格（Email 同步時由 bookings.total_price 帶入）
-- deposit     訂金
-- paid        是否已付款
-- 尾款 = price_total - deposit，由前端即時計算，不另存欄位
alter table bnb_daily_records
  add column if not exists price_total numeric,
  add column if not exists deposit numeric,
  add column if not exists paid boolean not null default false;
