-- 電話 webhook 原始內容紀錄：用來確認 Bird 實際送來的事件格式（欄位名、簽章標頭）後再對應程式。
-- 僅伺服器端寫入／讀取。
create table if not exists public.ivr_webhook_logs (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  headers jsonb,
  body text,
  verified boolean,
  created_at timestamptz not null default now()
);
create index if not exists ivr_webhook_logs_created_idx on public.ivr_webhook_logs(created_at desc);
alter table public.ivr_webhook_logs enable row level security;
