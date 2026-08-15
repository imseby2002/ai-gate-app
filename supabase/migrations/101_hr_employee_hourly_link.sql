-- HR：員工新增 時薪 + 考勤對應欄位（考勤工号／門市），供「時數→薪資」串接。
alter table public.hr_employees
  add column if not exists hourly_rate numeric not null default 0,   -- 時薪（工讀用）
  add column if not exists attendance_no text not null default '',   -- 考勤機工号（對應 hr_attendance）
  add column if not exists store text not null default '';           -- 門市
