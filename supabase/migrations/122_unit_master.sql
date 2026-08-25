-- =============================================
-- AI GATE - Migration 122
-- 基本資料系統（單位模組，A 案）：fin_stores 升級為「單位主檔」。
-- 門市只是 unit_type='store' 的一種；另有辦公室/工廠/各部門。
-- =============================================

alter table public.fin_stores
  add column if not exists unit_type       text not null default 'store', -- store/office/factory/gm/rd/audit/cashier/affairs/marketing/general/accounting/hr/repair/kitchen
  add column if not exists short_name      text not null default '',       -- 簡稱
  add column if not exists electricity_no  text not null default '',       -- 電號
  add column if not exists water_no        text not null default '',       -- 水號
  add column if not exists address         text not null default '',
  add column if not exists base_hourly_rate numeric not null default 0;    -- 基本時薪（覆寫；0＝用全公司預設）

-- 全公司基本時薪預設（薪資設定）
alter table public.hr_settings
  add column if not exists default_hourly_rate numeric not null default 0;
