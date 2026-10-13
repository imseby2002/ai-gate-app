-- 住宅代理：每位使用者一個 IPRoyal 子帳號（所有國家連線共用流量），每個子帳號最多 10 條固定 IP 連線（session）
CREATE TABLE IF NOT EXISTS public.marketing_resi_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  subuser_hash TEXT NOT NULL,
  username TEXT NOT NULL,
  password TEXT NOT NULL,
  traffic_gb NUMERIC(10,2) NOT NULL DEFAULT 0,
  sessions_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_marketing_resi_accounts_user ON public.marketing_resi_accounts(user_id);

-- 含子帳號帳密，僅伺服器（service role）存取
ALTER TABLE public.marketing_resi_accounts ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.marketing_proxy_leases
  ADD COLUMN IF NOT EXISTS resi_account_id UUID REFERENCES public.marketing_resi_accounts(id) ON DELETE SET NULL;
