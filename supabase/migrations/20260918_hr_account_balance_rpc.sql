-- 帳戶結餘改用 DB 端聚合計算，取代應用層抓全部交易列再加總。
-- 帳本量大時（如 26,000+ 筆），把整張表拉到 Node process 再迴圈加總，
-- 即使平行分頁也要花數秒到近一分鐘；改成單一 SQL 聚合查詢後，
-- 只需回傳「每個帳戶的異動淨額」這種小結果集，可在資料庫端用索引即時算完。

create index if not exists hr_cashflow_owner_account_idx
  on public.hr_cashflow (owner_id, account_id);

create index if not exists hr_cashflow_owner_to_account_idx
  on public.hr_cashflow (owner_id, to_account_id)
  where to_account_id is not null;

create or replace function public.fn_hr_account_balances(p_owner_id uuid)
returns table (account_id uuid, delta numeric)
language sql
stable
security definer
set search_path = public
as $$
  select id as account_id, sum(d) as delta
  from (
    select account_id as id,
           sum(case when type = 'income' then amount else -amount end) as d
    from hr_cashflow
    where owner_id = p_owner_id and account_id is not null
    group by account_id
    union all
    select to_account_id as id, sum(amount) as d
    from hr_cashflow
    where owner_id = p_owner_id and type = 'transfer' and to_account_id is not null
    group by to_account_id
  ) x
  group by id;
$$;
