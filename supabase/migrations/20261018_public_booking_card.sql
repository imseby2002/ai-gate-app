-- 官網訂房信用卡付款（AI-GATE 平台綠界）：記錄綠界訂單編號與綠界交易序號
alter table public.public_bookings
  add column if not exists ecpay_merchant_trade_no text,
  add column if not exists ecpay_trade_no text;

create unique index if not exists public_bookings_ecpay_mtn_key
  on public.public_bookings (ecpay_merchant_trade_no) where ecpay_merchant_trade_no is not null;

notify pgrst, 'reload schema';
