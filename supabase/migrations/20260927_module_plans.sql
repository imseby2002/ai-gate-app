-- 各 AI 模組（AI 對話／智慧圓桌／法律合規／AI Agent／職場助手）的訂閱方案：
-- 比照 cs/booking/marketing_subscriptions，但改為單一表以 (user_id, module) 為主鍵，
-- 新增模組不必再開新表。方案一律 free | core | pro | max，定義見 lib/module-plans/definitions.ts。
create table if not exists public.module_subscriptions (
  user_id             uuid not null references public.profiles(id) on delete cascade,
  module              text not null,                        -- chat | roundtable | legal | agent | resume
  plan                text not null default 'free',        -- free | core | pro | max
  billing_cycle       text not null default 'monthly',      -- monthly | yearly
  status              text not null default 'active',       -- active | past_due | canceled
  current_period_end  timestamptz,
  feature_overrides   jsonb not null default '{}',          -- 企業客製：單一帳號額外解鎖的功能
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  primary key (user_id, module)
);

alter table public.module_subscriptions enable row level security;

drop policy if exists "own module_subscriptions" on public.module_subscriptions;
create policy "own module_subscriptions" on public.module_subscriptions
  for select
  using (auth.uid() = user_id);

-- 修改方案只能由後端（service role）處理，不開放使用者自行 insert/update/delete。

-- 每月用量計數（方案內含次數上限用）：period 為 UTC+8 的 'YYYY-MM'
create table if not exists public.module_usage (
  user_id     uuid not null references public.profiles(id) on delete cascade,
  module      text not null,
  feature     text not null,
  period      text not null,
  count       int  not null default 0,
  updated_at  timestamptz not null default now(),
  primary key (user_id, module, feature, period)
);

alter table public.module_usage enable row level security;

drop policy if exists "own module_usage" on public.module_usage;
create policy "own module_usage" on public.module_usage
  for select
  using (auth.uid() = user_id);

-- 原子扣一次額度：未達上限則 +1 並回傳 true；已達上限回傳 false。
create or replace function public.consume_module_quota(
  p_user_id uuid, p_module text, p_feature text, p_period text, p_limit int
) returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count int;
begin
  insert into public.module_usage (user_id, module, feature, period, count)
  values (p_user_id, p_module, p_feature, p_period, 0)
  on conflict (user_id, module, feature, period) do nothing;

  update public.module_usage
     set count = count + 1, updated_at = now()
   where user_id = p_user_id and module = p_module and feature = p_feature and period = p_period
     and count < p_limit
  returning count into v_count;

  return v_count is not null;
end;
$$;

revoke all on function public.consume_module_quota(uuid, text, text, text, int) from public, anon, authenticated;
