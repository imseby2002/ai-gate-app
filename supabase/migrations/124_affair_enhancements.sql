-- =============================================
-- AI GATE - Migration 124
-- 外務模組升級：門市租約、門市衛生證、公司執照、專利證書、其他文書。
-- 支援多階提醒（繳費前 3 天、前 1 天；到期前 90 天、前 30 天、前 15 天緊急通報總經理室）。
-- 支援各角色 ZALO 個人 (透過 Zalo OA)。
-- =============================================

-- 1. affair_settings 擴充 ZALO 個人與總經理室管道、以及自訂天數
alter table public.affair_settings
  add column if not exists external_zalo text not null default '',
  add column if not exists general_zalo text not null default '',
  add column if not exists cashier_zalo text not null default '',
  add column if not exists gm_telegram text not null default '',
  add column if not exists gm_email text not null default '',
  add column if not exists gm_zalo text not null default '',
  add column if not exists default_expiry_stage1_days int not null default 90,
  add column if not exists default_expiry_stage2_days int not null default 30,
  add column if not exists default_expiry_urgent_days int not null default 15,
  add column if not exists default_pay_stage1_days int not null default 3,
  add column if not exists default_pay_stage2_days int not null default 1;

-- 2. affair_documents 擴充押金、租金、文字合約、階段天數、續約狀態
alter table public.affair_documents
  add column if not exists deposit numeric,
  add column if not exists monthly_rent numeric,
  add column if not exists contract_text text,
  add column if not exists is_renewed boolean not null default false,
  add column if not exists remind_days_stage2 int default 30,
  add column if not exists remind_days_urgent int default 15,
  add column if not exists pay_remind_days_2 int default 1;
