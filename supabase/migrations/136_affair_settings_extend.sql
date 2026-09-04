-- =============================================
-- AI GATE - Migration 136
-- 外務・合約提醒：affair_settings 補齊程式已在用、但表格從未新增的欄位
-- （總經理室通知管道、ZALO 個人、到期三階梯天數、繳費雙階天數），
-- 讓 API 的主要寫入路徑（非 fallback）直接生效。到期預設天數改為 30/15/7
-- （原 90/30/15），並新增後統一補上目前 fin_vendors/affair_documents 都還
-- 沒有的欄位供未來擴充比對使用。
-- =============================================

alter table public.affair_settings
  add column if not exists external_zalo text not null default '',
  add column if not exists general_zalo  text not null default '',
  add column if not exists cashier_zalo  text not null default '',
  add column if not exists gm_telegram   text not null default '',
  add column if not exists gm_email      text not null default '',
  add column if not exists gm_zalo       text not null default '',
  add column if not exists default_expiry_stage1_days int not null default 30,
  add column if not exists default_expiry_stage2_days int not null default 15,
  add column if not exists default_expiry_urgent_days int not null default 7,
  add column if not exists default_pay_stage1_days     int not null default 3,
  add column if not exists default_pay_stage2_days     int not null default 1;
