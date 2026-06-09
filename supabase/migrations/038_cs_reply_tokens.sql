-- LINE 省額度優化：暫存「尚未被 AI 用掉」的 reply token。
-- LINE 計費規則：Reply API（reply token，客戶傳訊後約 1 分鐘內、一次性）免費不計額度；
-- Push API 計入月額度。真人接管時 AI 不回覆 → reply token 未被使用，存於此表，
-- 讓客服在 1 分鐘內於收件匣回覆時改用免費 Reply API，逾時才 fallback 到 Push。
--
-- 每個對話只保留最新一枚 token（PK = user_id+platform+from_id，upsert 覆蓋）。
-- 僅 service role（webhook / cs-send）存取，啟用 RLS 但不建立任何 policy。
create table if not exists public.cs_reply_tokens (
  user_id uuid not null references public.profiles(id) on delete cascade,
  platform text not null,
  from_id text not null,
  reply_token text not null,
  created_at timestamptz not null default now(),
  primary key (user_id, platform, from_id)
);

alter table public.cs_reply_tokens enable row level security;
