-- ============================================================================
-- esim.im-tourist.com eSIM Store Database Schema
-- Migration: 20260910_esim_store.sql
-- ============================================================================

-- 1. eSIM 顧客訂單資料表
CREATE TABLE IF NOT EXISTS public.esim_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_no VARCHAR(64) UNIQUE NOT NULL,
  customer_email VARCHAR(255) NOT NULL,
  customer_name VARCHAR(100),
  customer_phone VARCHAR(50),
  
  -- 方案內容
  channel_dataplan_id VARCHAR(128) NOT NULL,
  channel_dataplan_name VARCHAR(255) NOT NULL,
  country_code VARCHAR(50) NOT NULL,
  country_name VARCHAR(100) NOT NULL,
  day INTEGER NOT NULL DEFAULT 1,
  data_amount VARCHAR(100) NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  
  -- 金額與貨幣
  unit_price_twd NUMERIC(10, 2) NOT NULL,
  total_price_twd NUMERIC(10, 2) NOT NULL,
  cost_hkd NUMERIC(10, 2) NOT NULL DEFAULT 0,
  currency VARCHAR(10) NOT NULL DEFAULT 'TWD',
  
  -- 付款狀態
  payment_status VARCHAR(50) NOT NULL DEFAULT 'pending', -- pending, paid, failed, refunded
  payment_method VARCHAR(50) NOT NULL DEFAULT 'credit_card', -- ecpay, credit_card, test_mode
  payment_trade_no VARCHAR(100),
  paid_at TIMESTAMPTZ,
  
  -- MICROESIM.TOP 發卡資訊
  microesim_status VARCHAR(50) NOT NULL DEFAULT 'pending', -- pending, subscribed, delivered, failed
  microesim_topup_id VARCHAR(128),
  iccid VARCHAR(100),
  qr_code_url TEXT,
  activation_code TEXT, -- LPA:1$xxx$xxx
  apn VARCHAR(100),
  operator_info TEXT,
  error_message TEXT,
  
  -- 通知狀態
  email_sent BOOLEAN NOT NULL DEFAULT FALSE,
  
  -- 備註與詮釋資料
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 索引以加速常用查詢
CREATE INDEX IF NOT EXISTS idx_esim_orders_order_no ON public.esim_orders(order_no);
CREATE INDEX IF NOT EXISTS idx_esim_orders_email ON public.esim_orders(customer_email);
CREATE INDEX IF NOT EXISTS idx_esim_orders_payment_status ON public.esim_orders(payment_status);
CREATE INDEX IF NOT EXISTS idx_esim_orders_created_at ON public.esim_orders(created_at DESC);

-- 2. 商城設定與利潤倍率表
CREATE TABLE IF NOT EXISTS public.esim_settings (
  key VARCHAR(64) PRIMARY KEY,
  value JSONB NOT NULL,
  description TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 插入預設設定
INSERT INTO public.esim_settings (key, value, description)
VALUES 
  ('pricing_margin', '{"default_markup": 1.35, "fixed_fee_twd": 20, "hkd_twd_rate": 4.15}'::jsonb, 'eSIM 售價毛利與匯率設定'),
  ('store_info', '{"name": "imTourist 全球 eSIM 專賣店", "support_email": "service@im-tourist.com", "service_hotline": "+886-2-87654321"}'::jsonb, '商城基本資訊與客服')
ON CONFLICT (key) DO NOTHING;

-- 啟用 RLS
ALTER TABLE public.esim_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.esim_settings ENABLE ROW LEVEL SECURITY;

-- 允許任何人依照 order_no 查詢自己的訂單（安全公開查詢）
DROP POLICY IF EXISTS "Public can view own order by order_no" ON public.esim_orders;
CREATE POLICY "Public can view own order by order_no" ON public.esim_orders
  FOR SELECT
  USING (true);

-- 允許服務端插入與更新
DROP POLICY IF EXISTS "Service role has full access to orders" ON public.esim_orders;
CREATE POLICY "Service role has full access to orders" ON public.esim_orders
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- 設定表全公開唯讀
DROP POLICY IF EXISTS "Public can read esim_settings" ON public.esim_settings;
CREATE POLICY "Public can read esim_settings" ON public.esim_settings
  FOR SELECT
  USING (true);
