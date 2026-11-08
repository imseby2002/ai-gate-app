-- 事件觸發的群組通知：訂單確認／行程異動時，自動準備文案並以 Telegram 通知持有人一鍵帶入（送出由持有人按）
create table if not exists public.marketing_group_notify_rules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade, -- 帳號擁有者（ownerId）
  event text not null check (event in ('order_confirmed', 'itinerary_changed')),
  app text not null check (app in ('line', 'zalo')),
  group_name text not null,
  holder_id uuid not null references auth.users(id) on delete cascade, -- 收 Telegram 通知的持有人
  enabled boolean not null default true,
  created_at timestamptz not null default now()
);
create index if not exists marketing_group_notify_rules_user_idx on public.marketing_group_notify_rules (user_id, event) where enabled;
alter table public.marketing_group_notify_rules enable row level security;
