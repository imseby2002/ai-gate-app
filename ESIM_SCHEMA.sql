-- ============================================================================
-- esim.im-tourist.com eSIM Store Database Schema
-- Run this in Supabase SQL Editor
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.esim_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_no VARCHAR(64) UNIQUE NOT NULL,
  customer_email VARCHAR(255) NOT NULL,
  customer_name VARCHAR(100),
  customer_phone VARCHAR(50),
  
  channel_dataplan_id VARCHAR(128) NOT NULL,
  channel_dataplan_name VARCHAR(255) NOT NULL,
  country_code VARCHAR(50) NOT NULL,
  country_name VARCHAR(100) NOT NULL,
  day INTEGER NOT NULL DEFAULT 1,
  data_amount VARCHAR(100) NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  
  unit_price_twd NUMERIC(10, 2) NOT NULL,
  total_price_twd NUMERIC(10, 2) NOT NULL,
  cost_hkd NUMERIC(10, 2) NOT NULL DEFAULT 0,
  currency VARCHAR(10) NOT NULL DEFAULT 'TWD',
  
  payment_status VARCHAR(50) NOT NULL DEFAULT 'pending',
  payment_method VARCHAR(50) NOT NULL DEFAULT 'credit_card',
  payment_trade_no VARCHAR(100),
  paid_at TIMESTAMPTZ,
  
  microesim_status VARCHAR(50) NOT NULL DEFAULT 'pending',
  microesim_topup_id VARCHAR(128),
  iccid VARCHAR(100),
  qr_code_url TEXT,
  activation_code TEXT,
  apn VARCHAR(100),
  operator_info TEXT,
  error_message TEXT,
  
  email_sent BOOLEAN NOT NULL DEFAULT FALSE,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_esim_orders_order_no ON public.esim_orders(order_no);
CREATE INDEX IF NOT EXISTS idx_esim_orders_email ON public.esim_orders(customer_email);
CREATE INDEX IF NOT EXISTS idx_esim_orders_payment_status ON public.esim_orders(payment_status);
CREATE INDEX IF NOT EXISTS idx_esim_orders_created_at ON public.esim_orders(created_at DESC);

CREATE TABLE IF NOT EXISTS public.esim_settings (
  key VARCHAR(64) PRIMARY KEY,
  value JSONB NOT NULL,
  description TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO public.esim_settings (key, value, description)
VALUES 
  ('pricing_margin', '{"default_markup": 1.35, "fixed_fee_twd": 20, "hkd_twd_rate": 4.15}'::jsonb, 'eSIM 售價毛利與匯率設定'),
  ('store_info', '{"name": "imTourist 全球 eSIM 專賣店", "support_email": "service@im-tourist.com", "service_hotline": "+886-2-87654321"}'::jsonb, '商城基本資訊與客服')
ON CONFLICT (key) DO NOTHING;

ALTER TABLE public.esim_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.esim_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can view own order by order_no" ON public.esim_orders;
CREATE POLICY "Public can view own order by order_no" ON public.esim_orders FOR SELECT USING (true);

DROP POLICY IF EXISTS "Service role has full access to orders" ON public.esim_orders;
CREATE POLICY "Service role has full access to orders" ON public.esim_orders FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public can read esim_settings" ON public.esim_settings;
CREATE POLICY "Public can read esim_settings" ON public.esim_settings FOR SELECT USING (true);
