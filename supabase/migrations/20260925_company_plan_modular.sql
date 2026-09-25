-- 公司方案改為模組化計價（見 src/lib/company/pricing.ts）：
-- 月費 = 公司基本費 + 開通模組費（companies.enabled_modules）+ ERP 人數 + 門市數 + 自訂網域。
-- 新增方案值 'company'；舊的 core/pro/max 保留給既有訂閱，到期後不再販售。

alter table public.company_subscriptions drop constraint if exists company_subscriptions_plan_check;
alter table public.company_subscriptions
  add constraint company_subscriptions_plan_check check (plan in ('free','core','pro','max','company'));

-- ERP 設定：erp_seats = 0 代表未開通 ERP；retail_stores = ERP 門市零售包的門市數
alter table public.company_subscriptions
  add column if not exists erp_seats integer not null default 0 check (erp_seats >= 0),
  add column if not exists retail_stores integer not null default 0 check (retail_stores >= 0),
  add column if not exists custom_domain boolean not null default false;

alter table public.company_plan_purchases drop constraint if exists company_plan_purchases_plan_check;
alter table public.company_plan_purchases
  add constraint company_plan_purchases_plan_check check (plan in ('core','pro','max','company'));

-- 結帳當下的計價明細快照（開通模組、人數、門市數、美金金額），供對帳
alter table public.company_plan_purchases
  add column if not exists pricing_snapshot jsonb;
