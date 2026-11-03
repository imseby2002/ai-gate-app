-- eSIM 商店（esim.im-tourist.com）訂單與設定（含優惠券）資料表。
-- 之前正式資料庫沒有這兩張表，程式退回寫伺服器暫存檔，Vercel 上會遺失（真實案例：建立的 500 張贈品券隔天消失）。
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
CREATE INDEX IF NOT EXISTS idx_esim_orders_email ON public.esim_orders(customer_email);
CREATE INDEX IF NOT EXISTS idx_esim_orders_payment_status ON public.esim_orders(payment_status);
CREATE INDEX IF NOT EXISTS idx_esim_orders_created_at ON public.esim_orders(created_at DESC);
CREATE TABLE IF NOT EXISTS public.esim_settings (
  key VARCHAR(64) PRIMARY KEY,
  value JSONB NOT NULL,
  description TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
-- 只允許伺服器端 service role 存取（RLS 開啟、不建任何公開 policy）
ALTER TABLE public.esim_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.esim_settings ENABLE ROW LEVEL SECURITY;
