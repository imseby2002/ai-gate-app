-- =============================================
-- AI GATE - Migration 20260930
-- 全資料庫每日備份至 Google Drive：設定表與匯出函式
-- =============================================

-- 1. 備份設定（單列，id = 'gdrive'）；僅 service_role 存取
create table if not exists public.system_backup_settings (
  id text primary key,
  email text not null default '',
  refresh_token text not null default '',
  folder_id text not null default '',
  last_run_at timestamptz,
  last_status text not null default '',
  last_file text not null default '',
  updated_at timestamptz not null default now()
);
alter table public.system_backup_settings enable row level security;

-- 2. 列出 public schema 的所有資料表（排除備份設定本身，避免 refresh token 外流）
create or replace function public.backup_list_tables()
returns setof text
language sql
security definer
set search_path = public
as $$
  select c.relname::text
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind = 'r' and c.relname <> 'system_backup_settings'
  order by c.relname;
$$;

-- 3. 匯出單一資料表全部資料為 JSON 陣列
create or replace function public.backup_table_json(t text)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  r json;
begin
  if t = 'system_backup_settings' then
    return '[]'::json;
  end if;
  execute format('select coalesce(json_agg(x), ''[]''::json) from public.%I x', t) into r;
  return r;
end;
$$;

revoke all on function public.backup_list_tables() from public, anon, authenticated;
revoke all on function public.backup_table_json(text) from public, anon, authenticated;
grant execute on function public.backup_list_tables() to service_role;
grant execute on function public.backup_table_json(text) to service_role;
