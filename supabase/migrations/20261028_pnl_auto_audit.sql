-- 業績損益報表自動化：
-- 1) pnl_stores 對應門市資料（fin_stores）＋比對用別名（出納摘要、薪資門市代碼）
-- 2) pnl_entry_logs：人工修改留痕（誰、何時、原值、新值、自動值、原因）
alter table public.pnl_stores
  add column if not exists fin_store_id uuid,
  add column if not exists aliases text[] not null default '{}';

create table if not exists public.pnl_entry_logs (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  store_id uuid not null references public.pnl_stores(id) on delete cascade,
  period text not null,
  line_code text not null,
  action text not null default 'set' check (action in ('set', 'revert')),
  old_amount numeric,          -- 修改前顯示值（人工值或自動值）
  new_amount numeric,          -- 修改後人工值；revert 為 null（改回自動）
  auto_amount numeric,         -- 當時系統自動計算值
  reason text not null default '',
  user_id uuid,
  user_name text not null default '',
  created_at timestamptz not null default now()
);
alter table public.pnl_entry_logs enable row level security;
create policy "own pnl_entry_logs" on public.pnl_entry_logs
  for select using (auth.uid() = owner_id);
create index if not exists pnl_entry_logs_lookup_idx on public.pnl_entry_logs(owner_id, period, store_id, line_code);
