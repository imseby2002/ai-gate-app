-- 公司層級會員方案：比照 cs_subscriptions／booking_subscriptions 的既有慣例
-- （free/core/pro/max、一次性付款、無自動續訂、到期即視同 free），但 key 換成
-- company_id——CS／訂房方案目前都掛在「個人」身上，公司實體本身還沒有自己的
-- 方案。免計費功能次數等公司層級權益，優先看這裡的方案預設值，
-- companies.free_feature_quota_monthly 手動覆寫值仍可疊加在方案預設值之上
-- （沒有覆寫值時才吃方案預設）。
create table public.company_subscriptions (
  company_id uuid primary key references public.companies(id) on delete cascade,
  plan text not null check (plan in ('free','core','pro','max')) default 'free',
  billing_cycle text not null default 'monthly',
  status text not null default 'active',
  current_period_end timestamptz,
  feature_overrides jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger company_subscriptions_updated_at
  before update on public.company_subscriptions
  for each row execute function public.update_updated_at();

alter table public.company_subscriptions enable row level security;

create policy "company_subscriptions_select_own" on public.company_subscriptions
  for select using (company_id = public.user_company_id());

create policy "company_subscriptions_admin" on public.company_subscriptions
  for all using (public.is_admin());
