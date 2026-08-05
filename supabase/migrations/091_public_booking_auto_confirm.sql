-- 官網訂房：讓民宿主自行選擇「旅客送出後自動確認」還是「需人工審核」。
alter table public.bnb_profiles
  add column if not exists auto_confirm_bookings boolean not null default false;
