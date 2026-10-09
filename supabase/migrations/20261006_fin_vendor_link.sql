-- =============================================
-- AI GATE - Migration 20261006 (vendor link)
-- 廠商填表好記網址 <公司子網域>/v/<link_slug> ＋ 密碼與錯誤鎖定
-- =============================================

alter table public.fin_vendors
  add column if not exists link_slug text,
  add column if not exists pin_hash text,
  add column if not exists pin_failed int not null default 0,
  add column if not exists pin_locked_until timestamptz;

create unique index if not exists fin_vendors_owner_link_slug
  on public.fin_vendors(owner_id, link_slug) where link_slug is not null;
