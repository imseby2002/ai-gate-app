-- =============================================
-- AI GATE - Migration 105
-- 應徵資料欄位鎖：電話/地址與檔案上傳應徵者可隨時修改；
-- 其他重要基本資料（姓名/身分證號/生日/Email/職位/門市）鎖定後，
-- 需人事「開放」才能由應徵者修改。
-- identity_locked 預設 false，讓應徵者先完成初次填寫；人事確認後上鎖。
-- =============================================

alter table public.agent_hr_candidates
  add column if not exists identity_locked boolean not null default false;
