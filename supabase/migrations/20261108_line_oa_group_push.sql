-- LINE 官方帳號群組排程推播
-- 官方帳號被邀進群組（join）或在群組收到訊息時，由客服 webhook 記錄群組；離開（leave）時標記。
create table if not exists public.marketing_line_groups (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade, -- webhook 所屬帳號（官方帳號擁有者）
  group_id text not null,
  name text,
  picture_url text,
  status text not null default 'active' check (status in ('active', 'left')),
  joined_at timestamptz not null default now(),
  left_at timestamptz,
  last_seen_at timestamptz not null default now(),
  unique (user_id, group_id)
);
create index if not exists marketing_line_groups_user_idx on public.marketing_line_groups (user_id, status);

create table if not exists public.marketing_line_group_posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade, -- 建立者
  group_ids uuid[] not null,                                         -- marketing_line_groups.id
  text text not null,
  image_url text,
  scheduled_at timestamptz not null,
  status text not null default 'scheduled' check (status in ('scheduled', 'sending', 'sent', 'partial', 'failed', 'canceled')),
  results jsonb not null default '[]'::jsonb,
  sent_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists marketing_line_group_posts_due_idx on public.marketing_line_group_posts (status, scheduled_at);
create index if not exists marketing_line_group_posts_user_idx on public.marketing_line_group_posts (user_id, created_at desc);

alter table public.marketing_line_groups enable row level security;
alter table public.marketing_line_group_posts enable row level security;
-- 讀寫一律經 API（service role）；不開放前端直接存取
