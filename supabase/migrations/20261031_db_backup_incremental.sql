-- 資料庫備份改為「每月一次完整備份 + 每日只備份有變動的資料表」，降低 Supabase 對外流量
alter table public.system_backup_settings
  add column if not exists last_full_at timestamptz,
  add column if not exists table_counters jsonb not null default '{}'::jsonb;

-- 各資料表累計異動次數（新增＋更新＋刪除），與上次備份時比對即可知道哪些表有變動
create or replace function public.backup_table_counters()
returns table (t text, n bigint)
language sql
security definer
set search_path = public
as $$
  select s.relname::text, (s.n_tup_ins + s.n_tup_upd + s.n_tup_del)::bigint
  from pg_stat_user_tables s
  where s.schemaname = 'public' and s.relname <> 'system_backup_settings';
$$;

revoke all on function public.backup_table_counters() from public, anon, authenticated;
grant execute on function public.backup_table_counters() to service_role;
