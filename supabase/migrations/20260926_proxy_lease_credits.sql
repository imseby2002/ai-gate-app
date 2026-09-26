-- 官方發文 IP：方案附贈以外的額外 IP 以點數購買（每 30 天扣一次，到期自動續扣，點數不足即到期釋放）
ALTER TABLE public.marketing_proxy_leases
  ADD COLUMN IF NOT EXISTS is_paid BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS price_credits NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS auto_renew BOOLEAN NOT NULL DEFAULT true;

-- 附贈 IP 不設到期（方案有效期間持續使用）
ALTER TABLE public.marketing_proxy_leases ALTER COLUMN expires_at DROP DEFAULT;

CREATE INDEX IF NOT EXISTS idx_marketing_proxy_leases_renew
  ON public.marketing_proxy_leases(expires_at)
  WHERE status = 'active' AND is_paid = true;

-- 代理池中由租用注入的節點，連回對應租用紀錄（退租／到期時一併移除）
ALTER TABLE public.marketing_proxies
  ADD COLUMN IF NOT EXISTS lease_id UUID REFERENCES public.marketing_proxy_leases(id) ON DELETE CASCADE;
