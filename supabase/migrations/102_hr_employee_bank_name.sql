-- HR：員工新增「收款銀行」欄位，供銀行撥款檔匯出。
alter table public.hr_employees
  add column if not exists bank_name text not null default '';
