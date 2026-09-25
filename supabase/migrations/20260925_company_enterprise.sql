-- 專屬客製-企業版：隱藏方案，只有平台管理者能開啟（company_subscriptions.enterprise）。
-- 企業版建立在「公司版」（plan = 'company'）之上：模組 MAX、成員不限；另外
--   1. 點數功能不扣點、不檢查餘額，但用量照樣記錄在 company_credit_transactions（bucket = 'enterprise'）
--   2. CHAT 開放高階模型與生圖／影片、無每日上限
--   3. 功能新增／調整不限次數
--   4. 月費由管理者議價後填入 enterprise_monthly_usd；當月用量達月費 × cost_alert_ratio 時通知管理者（每月一次）

alter table public.company_subscriptions
  add column if not exists enterprise boolean not null default false,
  add column if not exists enterprise_monthly_usd numeric check (enterprise_monthly_usd >= 0),
  add column if not exists cost_alert_ratio numeric not null default 0.5 check (cost_alert_ratio > 0);

alter table public.company_credit_transactions drop constraint if exists company_credit_transactions_bucket_check;
alter table public.company_credit_transactions
  add constraint company_credit_transactions_bucket_check check (bucket in ('gift','paid','enterprise'));

-- 成本警示寄送紀錄：同一公司同一月份只通知一次
create table public.company_cost_alerts (
  company_id uuid not null references public.companies(id) on delete cascade,
  month text not null,                 -- 'YYYY-MM'（台北時間）
  usage_usd numeric not null,
  alerted_at timestamptz not null default now(),
  primary key (company_id, month)
);
alter table public.company_cost_alerts enable row level security;
create policy "company_cost_alerts_admin" on public.company_cost_alerts for all using (public.is_admin());

-- 企業版是否有效：公司版有效且已開啟企業版
create or replace function public.company_enterprise_active(p_company_id uuid) returns boolean
language sql stable security definer set search_path to 'public' as $$
  select public.company_plan_active(p_company_id) and exists (
    select 1 from public.company_subscriptions where company_id = p_company_id and enterprise
  )
$$;

-- 企業版用量記錄（不扣點）。回傳本月（台北時間）企業版記錄用量合計。
create or replace function public.record_company_usage(
  p_company_id uuid, p_user_id uuid, p_amount numeric, p_description text
) returns numeric
language plpgsql security definer set search_path to 'public' as $$
declare v_total numeric;
begin
  if p_amount < 0 then raise exception 'INVALID_AMOUNT'; end if;
  if p_amount > 0 then
    insert into public.company_credit_transactions (company_id, user_id, bucket, type, amount_usd, description)
      values (p_company_id, p_user_id, 'enterprise', 'usage', -p_amount, p_description);
  end if;
  select coalesce(-sum(amount_usd), 0) into v_total
    from public.company_credit_transactions
   where company_id = p_company_id and bucket = 'enterprise'
     and created_at >= (date_trunc('month', now() at time zone 'Asia/Taipei') at time zone 'Asia/Taipei');
  return v_total;
end $$;

revoke execute on function public.record_company_usage(uuid, uuid, numeric, text) from public, anon, authenticated;
