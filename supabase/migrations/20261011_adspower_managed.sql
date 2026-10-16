-- 方案二「AI-GATE 代管 AdsPower」：客人申請 → 管理員在 AdsPower 團隊建立成員帳號與專屬分組後填入開通。
-- 成員只被授權自己的分組，彼此看不到；登入密碼以 AES-256-GCM（lib/crypto/secret）加密儲存。
create table if not exists public.marketing_adspower_managed (
  user_id uuid primary key references auth.users(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'active', 'rejected', 'revoked')),
  contact text,
  note text,
  login_account text,
  login_password_enc text,
  group_name text,
  admin_note text,
  requested_at timestamptz not null default now(),
  activated_at timestamptz,
  updated_at timestamptz not null default now()
);

-- 僅經伺服器端（service role）存取，不開放前端直接讀寫
alter table public.marketing_adspower_managed enable row level security;
