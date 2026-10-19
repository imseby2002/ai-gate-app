alter table public.agent_hr_candidates add column if not exists profile_edit_until timestamptz;
alter table public.agent_hr_candidates add column if not exists resume_updated_at timestamptz;
alter table public.hr_settings add column if not exists profile_edit_days integer not null default 0;
comment on column public.agent_hr_candidates.profile_edit_until is '履歷可自行修改的截止時間；null＝不自動關閉（identity_locked=true 為人事手動關閉）';
comment on column public.hr_settings.profile_edit_days is '開放履歷修改後幾天自動關閉；0＝不自動關閉';
