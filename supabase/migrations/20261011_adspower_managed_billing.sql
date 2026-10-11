-- 代管 AdsPower 收費：額度包（環境數）＋月付／年付，以點數（USD）扣款；到期自動續扣，不足則暫停。
alter table public.marketing_adspower_managed
  add column if not exists env_quota integer not null default 10,
  add column if not exists billing_cycle text not null default 'monthly',
  add column if not exists price_credits numeric,
  add column if not exists paid_until timestamptz,
  add column if not exists auto_renew boolean not null default true,
  add column if not exists next_env_quota integer,
  add column if not exists next_billing_cycle text;

alter table public.marketing_adspower_managed drop constraint if exists marketing_adspower_managed_status_check;
alter table public.marketing_adspower_managed
  add constraint marketing_adspower_managed_status_check
  check (status in ('pending', 'active', 'suspended', 'rejected', 'revoked'));

alter table public.marketing_adspower_managed drop constraint if exists marketing_adspower_managed_cycle_check;
alter table public.marketing_adspower_managed
  add constraint marketing_adspower_managed_cycle_check
  check (billing_cycle in ('monthly', 'annual') and (next_billing_cycle is null or next_billing_cycle in ('monthly', 'annual')));
