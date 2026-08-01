-- 即時同步（Channex 等第三方）目前尚未自助開通，仍是人工協助設置。
-- 這個欄位讓管理員在實際接通某民宿的即時同步後手動標記為 true；
-- Email／iCal 同步在讀到 true 時會直接停用，避免三個資料來源互相打架。
alter table public.booking_subscriptions
  add column if not exists realtime_sync_active boolean not null default false;
