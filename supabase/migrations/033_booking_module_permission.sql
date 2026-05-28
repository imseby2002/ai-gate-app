-- 加入 booking 模組權限：預設全開（模型 A——任何功能登入即可用，管理者再從後台限制）。
-- 既有使用者補上 booking，維持原本可用訂房系統的行為。
alter table public.profiles
  alter column enabled_modules
  set default array['chat','marketing','cs','leads','resume','booking']::text[];

update public.profiles
set enabled_modules = enabled_modules || array['booking']::text[]
where enabled_modules is not null
  and not ('booking' = any(enabled_modules));
