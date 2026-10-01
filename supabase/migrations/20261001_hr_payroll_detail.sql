-- 薪資明細欄位（對應越南會計薪資表 bảng lương 各欄）
--  net_pay 仍由 base_salary + allowances + bonus - deductions 產生；
--  明細欄位保留原表數字，彙總欄位依下列規則填入：
--    base_salary = Lương cb
--    allowances  = Lương trách nhiệm + Tiền làm thêm + trợ cấp ăn/xăng xe
--    bonus       = 各項獎金（Thưởng tháng / trách nhiệm / KPI / doanh thu / lễ tết / hoa hồng）
--    deductions  = 所有扣款（含罰款、員工保險、工會費、制服、個人所得稅）

-- 會計用員工編號（薪資表 Mã NV，例如 VP01）；hr_employees.attendance_no 為打卡機編號
alter table public.hr_employees add column if not exists payroll_code text not null default '';

alter table public.hr_payroll
  add column if not exists payroll_code text not null default '',          -- 當月薪資表 Mã NV
  add column if not exists store text not null default '',
  add column if not exists position text not null default '',
  add column if not exists rank text not null default '',                  -- Xếp hạng
  add column if not exists ot_hours numeric not null default 0,            -- số giờ làm thêm
  add column if not exists insurance_salary numeric not null default 0,    -- Lương bảo hiểm
  add column if not exists responsibility_pay numeric not null default 0,  -- Lương trách nhiệm
  add column if not exists overtime_pay numeric not null default 0,        -- Tiền làm thêm
  add column if not exists monthly_bonus numeric not null default 0,       -- Thưởng tháng
  add column if not exists responsibility_bonus numeric not null default 0,-- Thưởng trách nhiệm
  add column if not exists kpi_bonus numeric not null default 0,           -- KPI
  add column if not exists revenue_bonus numeric not null default 0,       -- Thưởng doanh thu
  add column if not exists holiday_bonus numeric not null default 0,       -- Thưởng lễ/tết, sinh nhật
  add column if not exists commission numeric not null default 0,          -- Thưởng hoa hồng
  add column if not exists meal_travel_allowance numeric not null default 0, -- Trợ cấp ăn + xăng xe
  add column if not exists gross_total numeric not null default 0,         -- Tổng lương
  add column if not exists non_taxable_income numeric not null default 0,  -- TN không chịu thuế
  add column if not exists taxable_income numeric not null default 0,      -- TN chịu thuế
  add column if not exists penalty numeric not null default 0,             -- Thiếu doanh thu + phạt
  add column if not exists employee_insurance numeric not null default 0,  -- BHXH nhân viên
  add column if not exists union_fee numeric not null default 0,           -- Đoàn phí công đoàn
  add column if not exists uniform_fee numeric not null default 0,         -- Đồng phục
  add column if not exists personal_deduction numeric not null default 0,  -- GTBT 本人扣除
  add column if not exists dependent_deduction numeric not null default 0, -- GTNPT 扶養扣除
  add column if not exists assessable_contract numeric not null default 0, -- 課稅所得（勞動合約）
  add column if not exists assessable_casual numeric not null default 0,   -- 課稅所得（短期）
  add column if not exists pit_contract numeric not null default 0,        -- TTNCN 勞動合約
  add column if not exists pit_casual numeric not null default 0,          -- TTNCN 短期
  add column if not exists employer_insurance numeric not null default 0,  -- BHXH doanh nghiệp
  add column if not exists employer_union numeric not null default 0,      -- Công đoàn（公司負擔）
  add column if not exists source text not null default '';                -- 匯入來源
