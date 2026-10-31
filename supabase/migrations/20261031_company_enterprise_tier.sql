-- 企業方案等級：企業 CORE／PRO／MAX（定價見 src/lib/company/enterprise-plans.ts）。
-- 只在 enterprise = true 時有意義；null = 尚未指定等級（沿用議價月費）。
alter table public.company_subscriptions
  add column if not exists enterprise_tier text
    check (enterprise_tier in ('core', 'pro', 'max'));
