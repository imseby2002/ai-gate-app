-- 住宅代理：每組（一個 IPRoyal 帳號）最多 10 個子帳號名額；使用者購買時以 API 建立子帳號並配發 GB（不過期，可加購）
ALTER TABLE public.marketing_official_proxies
  ADD COLUMN IF NOT EXISTS api_token TEXT;

ALTER TABLE public.marketing_proxy_leases
  ADD COLUMN IF NOT EXISTS traffic_gb NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS subuser_hash TEXT;
