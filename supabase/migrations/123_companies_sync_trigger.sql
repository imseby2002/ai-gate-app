-- company_members 狀態轉為/離開 active 時，自動同步 profiles.company_id。
-- 交給 DB trigger 保證一致，不靠應用層手動同步——這個 codebase 已經吃過
-- 欄位/程式碼各自為政導致 drift 的虧（例如 credit_balance、compiled_md
-- 沒被實際使用/讀取的落差），這裡不重蹈覆轍。
create or replace function public.sync_profile_company_id() returns trigger
  language plpgsql security definer set search_path to 'public' as $$
begin
  if TG_OP in ('INSERT','UPDATE') and new.status = 'active' then
    update public.profiles set company_id = new.company_id where id = new.member_id;
  elsif TG_OP = 'UPDATE' and old.status = 'active' and new.status <> 'active' then
    update public.profiles set company_id = null where id = new.member_id and company_id = old.company_id;
  elsif TG_OP = 'DELETE' and old.status = 'active' then
    update public.profiles set company_id = null where id = old.member_id and company_id = old.company_id;
  end if;
  return coalesce(new, old);
end;
$$;

create trigger trg_sync_profile_company_id
  after insert or update of status or delete on public.company_members
  for each row execute function public.sync_profile_company_id();

-- 比照 claim_bnb_invitations()：登入者自動認領信箱相符的待接受公司邀請。
-- 上面的 UPDATE 會讓 status 轉為 active，連帶觸發 trg_sync_profile_company_id
-- 自動同步 profiles.company_id，不需要額外的同步程式碼。
create or replace function public.claim_company_invitations() returns integer
  language plpgsql security definer set search_path to 'public' as $$
declare n integer;
begin
  update public.company_members
     set member_id = auth.uid(), status = 'active', accepted_at = now()
   where status = 'pending'
     and member_id is null
     and lower(invited_email) = lower(coalesce(auth.jwt()->>'email',''));
  get diagnostics n = row_count;
  return coalesce(n,0);
end $$;
