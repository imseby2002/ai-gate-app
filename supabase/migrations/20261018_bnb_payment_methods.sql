-- 官網訂房付款方式：民宿可勾選開放「到店付款／銀行轉帳／信用卡」，轉帳顯示匯款帳號。
-- 金流金鑰（信用卡）屬機密，不放 bnb_profiles（公開訂房 API 會回傳整列 profile），另表存放。
alter table public.bnb_profiles
  add column if not exists payment_methods text[] not null default '{on_arrival}',
  add column if not exists bank_transfer jsonb;  -- {bank_name, bank_code, account_name, account_no, deadline_hours, note}

alter table public.public_bookings
  add column if not exists payment_status text not null default 'unpaid',  -- unpaid / reported / paid
  add column if not exists transfer_last5 text,
  add column if not exists paid_at timestamptz;

notify pgrst, 'reload schema';
