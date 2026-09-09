-- =============================================
-- AI GATE - Migration 149
-- 門市帳號綁定所屬門市 (store_code)
-- 門市營運所有功能：若帳號綁定特定門市，進去後強制鎖定本門市，不可切換或查看其他門市
-- =============================================

alter table public.profiles
  add column if not exists store_code text;

create index if not exists idx_profiles_store_code on public.profiles(store_code);

alter table public.company_members
  add column if not exists store_code text;
