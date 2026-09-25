-- 公司專屬子網域：<slug>.im-tourist.com（見 src/lib/company/subdomain.ts 的保留字與格式規則）
alter table public.companies
  add column if not exists slug text unique
    check (slug ~ '^[a-z0-9]([a-z0-9-]{0,30}[a-z0-9])?$');
