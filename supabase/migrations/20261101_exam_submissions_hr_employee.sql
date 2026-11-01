-- 員工專區（免系統帳號）作答：成績記在員工名下
alter table public.exam_submissions add column if not exists hr_employee_id uuid references public.hr_employees(id) on delete set null;
create index if not exists exam_submissions_hr_employee_idx on public.exam_submissions(hr_employee_id, exam_id);
