-- 公司法定名稱與品牌名稱拆開：既有 name 維持為品牌名稱
alter table if exists public.mkt_brand
  add column if not exists legal_name text not null default '';
