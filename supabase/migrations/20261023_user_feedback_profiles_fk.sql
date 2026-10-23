-- user_feedback.user_id 只參照 auth.users，PostgREST 無法嵌入 profiles(...)，
-- /api/office/proposals 與 /api/feedback 的 select 因此一律回 400（提案列表顯示 0 筆）。
-- profiles.id 即 auth.users.id，補一條指向 profiles 的 FK 讓嵌入可用。
alter table public.user_feedback
  add constraint user_feedback_user_id_profiles_fkey
  foreign key (user_id) references public.profiles(id) on delete cascade not valid;
alter table public.user_feedback validate constraint user_feedback_user_id_profiles_fkey;

-- 既有提案補上公司（依提案人 profile）
update public.user_feedback f
set company_id = p.company_id
from public.profiles p
where p.id = f.user_id and f.company_id is null and p.company_id is not null;

notify pgrst, 'reload schema';
