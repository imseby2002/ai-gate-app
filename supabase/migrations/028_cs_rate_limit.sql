-- 028: 客服 webhook 速率限制（固定視窗計數器）
-- 用途：防止對外公開的 cs-webhook 被灌訊息／燒 API 費用。
-- 由後端透過 RPC check_cs_rate_limit 原子遞增計數，超過上限即回 false。

create table if not exists cs_rate_limits (
  bucket       text        not null,
  window_start timestamptz not null,
  count        integer     not null default 0,
  primary key (bucket, window_start)
);

create index if not exists idx_cs_rate_limits_window
  on cs_rate_limits (window_start);

-- 只有後端（service role）會呼叫；啟用 RLS 並不開放任何 policy，
-- 一般使用者無法直接讀寫此表。
alter table cs_rate_limits enable row level security;

-- 原子地遞增目前視窗的計數，回傳是否仍在上限內。
-- p_bucket：限流鍵（例如 "<userId>:<customerId>"）
-- p_limit：每個視窗允許的訊息數
-- p_window_seconds：視窗長度（秒）
create or replace function check_cs_rate_limit(
  p_bucket         text,
  p_limit          integer,
  p_window_seconds integer
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_window timestamptz := to_timestamp(
    floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds
  );
  v_count integer;
begin
  insert into cs_rate_limits (bucket, window_start, count)
  values (p_bucket, v_window, 1)
  on conflict (bucket, window_start)
    do update set count = cs_rate_limits.count + 1
  returning count into v_count;

  return v_count <= p_limit;
end;
$$;

-- 清理舊視窗資料，避免無限成長（可由排程定期呼叫）。
create or replace function cleanup_cs_rate_limits()
returns void
language sql
security definer
set search_path = public
as $$
  delete from cs_rate_limits where window_start < now() - interval '1 day';
$$;
