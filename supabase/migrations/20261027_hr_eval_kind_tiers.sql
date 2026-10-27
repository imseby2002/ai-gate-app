-- 考核評分分成「領班評分（store）」與「辦公室評分（office）」，每位員工每月各一份
alter table public.hr_evaluations
  add column if not exists kind text not null default 'store',
  add column if not exists tier_amount numeric not null default 0; -- 依評等對應獎金表算出的金額（存檔時快照）
alter table public.hr_evaluations drop constraint if exists hr_evaluations_kind_check;
alter table public.hr_evaluations add constraint hr_evaluations_kind_check check (kind in ('store', 'office'));
alter table public.hr_evaluations drop constraint if exists hr_evaluations_owner_id_employee_id_year_month_key;
alter table public.hr_evaluations drop constraint if exists hr_evaluations_owner_emp_ym_kind_key;
alter table public.hr_evaluations add constraint hr_evaluations_owner_emp_ym_kind_key unique (owner_id, employee_id, year, month, kind);

-- 評等 → 獎金對應表：{ "store": [{"rating":"A+","amount":0}, ...], "office": [...] }
alter table public.hr_settings add column if not exists eval_tiers jsonb not null default '{}'::jsonb;
