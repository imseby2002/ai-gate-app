-- 官方發文 IP 改以 USD 計價（點數＝美金）
-- ISP 獨享／共享：按 IP 月租 monthly_price_usd；住宅代理：流量包 price_per_gb_usd × traffic_gb（每 30 天）
ALTER TABLE public.marketing_official_proxies
  ADD COLUMN IF NOT EXISTS monthly_price_usd NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS price_per_gb_usd NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS traffic_gb INTEGER,
  ADD COLUMN IF NOT EXISTS is_shared BOOLEAN NOT NULL DEFAULT false;
