-- 客服客戶記憶：身分事實（facts）+ 背景彙整時間戳記（summarized_at）
-- facts：客人身分事實（訂單號碼/電話/訂房大名/房號等），在查詢成功比對到訂單時
--   直接寫入，供之後對話直接引用，避免重複詢問已經核對過的資訊。
-- summarized_at：上次背景彙整 summary 的時間；只有 last_message_at 比這個時間新
--   才需要重新彙整，避免每次 cron 都重跑同一位客人。
alter table cs_customers
  add column if not exists facts jsonb not null default '{}'::jsonb,
  add column if not exists summarized_at timestamptz;

comment on column cs_customers.facts is '客人身分事實（訂單號碼/電話/訂房大名/房號等），在查詢成功比對到訂單時直接寫入，供之後對話直接引用，避免重複詢問已經核對過的資訊。';
comment on column cs_customers.summarized_at is '上次背景彙整 summary 的時間；只有 last_message_at 比這個時間新才需要重新彙整，避免每次 cron 都重跑同一位客人。';
