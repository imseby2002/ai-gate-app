-- 電話行銷依實際通話分鐘數扣點：記錄通話秒數與扣點結果，billed_at 作為防重複扣點的鎖。
alter table public.ivr_calls
  add column if not exists duration_sec integer,
  add column if not exists billed_credits numeric,
  add column if not exists billed_at timestamptz;
