-- Migration: 20260914_official_rentable_proxies.sql
-- Description: Schema for AI-GATE Official Rentable IP Pool and User Leases

-- 1. Official Rentable Proxies Table (管理者維護的官方供租用 IP 資源庫)
CREATE TABLE IF NOT EXISTS public.marketing_official_proxies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  proxy_type TEXT NOT NULL DEFAULT 'home_static', -- 'home_static' | 'residential' | 'mobile_4g'
  protocol TEXT NOT NULL DEFAULT 'http',         -- 'http' | 'https' | 'socks5'
  host TEXT NOT NULL,
  port INTEGER NOT NULL,
  username TEXT,
  password TEXT,
  country TEXT DEFAULT 'TW',
  city TEXT,
  isp TEXT,
  latency_ms INTEGER DEFAULT 20,
  monthly_price_twd INTEGER DEFAULT 199,
  max_tenants INTEGER DEFAULT 1,                 -- 1 = 專屬獨享
  current_tenants_count INTEGER DEFAULT 0,
  status TEXT DEFAULT 'available',               -- 'available' | 'rented_out' | 'maintenance'
  is_active BOOLEAN DEFAULT true,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS for official proxies
ALTER TABLE public.marketing_official_proxies ENABLE ROW LEVEL SECURITY;

-- Everyone authenticated can view active official proxies
CREATE POLICY "Authenticated users can view active official proxies"
  ON public.marketing_official_proxies
  FOR SELECT
  TO authenticated
  USING (is_active = true);

-- Only admins can insert/update/delete official proxies
CREATE POLICY "Admins can manage official proxies"
  ON public.marketing_official_proxies
  FOR ALL
  TO authenticated
  USING (
    auth.jwt() ->> 'email' = 'imseby@gmail.com'
    OR auth.jwt() ->> 'email' = current_setting('app.settings.admin_email', true)
    OR EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() AND profiles.user_type = 'admin'
    )
  );


-- 2. User Proxy Leases Table (使用者向 AI-GATE 官方租用 IP 紀錄)
CREATE TABLE IF NOT EXISTS public.marketing_proxy_leases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  official_proxy_id UUID NOT NULL REFERENCES public.marketing_official_proxies(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'active',                  -- 'active' | 'expired' | 'canceled'
  rented_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ DEFAULT (now() + INTERVAL '30 days'),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_marketing_proxy_leases_user ON public.marketing_proxy_leases(user_id);
CREATE INDEX IF NOT EXISTS idx_marketing_proxy_leases_proxy ON public.marketing_proxy_leases(official_proxy_id);

ALTER TABLE public.marketing_proxy_leases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view and manage their own proxy leases"
  ON public.marketing_proxy_leases
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
