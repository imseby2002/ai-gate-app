-- 服務業預約系統 (Service Reservation System for Beauty, Hair, Clinic, Spa, etc.)
-- Migration: 20261103180000_service_reservation_system.sql

CREATE TABLE IF NOT EXISTS public.reserve_stores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  company_id UUID REFERENCES public.companies(id) ON DELETE SET NULL,
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'beauty', -- 'beauty', 'hair', 'clinic', 'spa', 'fitness', 'pet', 'other'
  description TEXT,
  phone TEXT,
  email TEXT,
  address TEXT,
  cover_url TEXT,
  logo_url TEXT,
  business_hours JSONB NOT NULL DEFAULT '{
    "mon": {"open": "10:00", "close": "20:00", "closed": false},
    "tue": {"open": "10:00", "close": "20:00", "closed": false},
    "wed": {"open": "10:00", "close": "20:00", "closed": false},
    "thu": {"open": "10:00", "close": "20:00", "closed": false},
    "fri": {"open": "10:00", "close": "20:00", "closed": false},
    "sat": {"open": "10:00", "close": "19:00", "closed": false},
    "sun": {"open": "10:00", "close": "18:00", "closed": true}
  }'::jsonb,
  slot_interval_minutes INT NOT NULL DEFAULT 30,
  advance_booking_days INT NOT NULL DEFAULT 30,
  min_booking_hours INT NOT NULL DEFAULT 2,
  allow_any_staff BOOLEAN NOT NULL DEFAULT true,
  deposit_required BOOLEAN NOT NULL DEFAULT false,
  deposit_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'TWD',
  notice TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.reserve_services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES public.reserve_stores(id) ON DELETE CASCADE,
  category_name TEXT NOT NULL DEFAULT '主要服務',
  name TEXT NOT NULL,
  description TEXT,
  duration_minutes INT NOT NULL DEFAULT 60,
  buffer_minutes INT NOT NULL DEFAULT 10,
  price NUMERIC(10,2) NOT NULL DEFAULT 0,
  sale_price NUMERIC(10,2),
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INT NOT NULL DEFAULT 0,
  image_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.reserve_staff (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES public.reserve_stores(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  title TEXT NOT NULL DEFAULT '專業技術師',
  avatar_url TEXT,
  bio TEXT,
  service_ids TEXT[] DEFAULT '{}',
  weekly_schedule JSONB NOT NULL DEFAULT '{
    "mon": {"work": true, "start": "10:00", "end": "20:00"},
    "tue": {"work": true, "start": "10:00", "end": "20:00"},
    "wed": {"work": true, "start": "10:00", "end": "20:00"},
    "thu": {"work": true, "start": "10:00", "end": "20:00"},
    "fri": {"work": true, "start": "10:00", "end": "20:00"},
    "sat": {"work": true, "start": "10:00", "end": "19:00"},
    "sun": {"work": false, "start": "10:00", "end": "18:00"}
  }'::jsonb,
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.reserve_appointments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  appointment_no TEXT UNIQUE NOT NULL,
  store_id UUID NOT NULL REFERENCES public.reserve_stores(id) ON DELETE CASCADE,
  service_id UUID REFERENCES public.reserve_services(id) ON DELETE SET NULL,
  staff_id UUID REFERENCES public.reserve_staff(id) ON DELETE SET NULL,
  customer_name TEXT NOT NULL,
  customer_phone TEXT NOT NULL,
  customer_email TEXT,
  customer_notes TEXT,
  internal_notes TEXT,
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'in_progress', 'completed', 'cancelled', 'no_show')),
  total_price NUMERIC(10,2) NOT NULL DEFAULT 0,
  payment_status TEXT NOT NULL DEFAULT 'unpaid' CHECK (payment_status IN ('unpaid', 'deposit_paid', 'paid', 'refunded')),
  cancel_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.reserve_customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES public.reserve_stores(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT,
  tags TEXT[] DEFAULT '{}',
  preferences TEXT,
  total_visits INT NOT NULL DEFAULT 0,
  total_spent NUMERIC(10,2) NOT NULL DEFAULT 0,
  last_visit_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT reserve_customers_store_phone_unique UNIQUE (store_id, phone)
);

CREATE TABLE IF NOT EXISTS public.reserve_ai_insights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES public.reserve_stores(id) ON DELETE CASCADE,
  type TEXT NOT NULL, -- 'schedule_opt', 'followup_sms', 'capacity_forecast', 'chat_intent'
  prompt TEXT NOT NULL,
  result JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indices
CREATE INDEX IF NOT EXISTS idx_reserve_stores_user_id ON public.reserve_stores(user_id);
CREATE INDEX IF NOT EXISTS idx_reserve_stores_slug ON public.reserve_stores(slug);
CREATE INDEX IF NOT EXISTS idx_reserve_services_store_id ON public.reserve_services(store_id);
CREATE INDEX IF NOT EXISTS idx_reserve_staff_store_id ON public.reserve_staff(store_id);
CREATE INDEX IF NOT EXISTS idx_reserve_appointments_store_id ON public.reserve_appointments(store_id);
CREATE INDEX IF NOT EXISTS idx_reserve_appointments_start_time ON public.reserve_appointments(start_time);
CREATE INDEX IF NOT EXISTS idx_reserve_appointments_status ON public.reserve_appointments(status);
CREATE INDEX IF NOT EXISTS idx_reserve_customers_store_id ON public.reserve_customers(store_id);

-- RLS
ALTER TABLE public.reserve_stores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reserve_services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reserve_staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reserve_appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reserve_customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reserve_ai_insights ENABLE ROW LEVEL SECURITY;

-- Policies for reserve_stores
CREATE POLICY "Public read active stores" ON public.reserve_stores
  FOR SELECT USING (is_active = true);

CREATE POLICY "Owners manage their stores" ON public.reserve_stores
  FOR ALL USING (auth.uid() = user_id);

-- Policies for reserve_services
CREATE POLICY "Public read active services" ON public.reserve_services
  FOR SELECT USING (is_active = true);

CREATE POLICY "Owners manage services" ON public.reserve_services
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.reserve_stores s WHERE s.id = store_id AND s.user_id = auth.uid())
  );

-- Policies for reserve_staff
CREATE POLICY "Public read active staff" ON public.reserve_staff
  FOR SELECT USING (is_active = true);

CREATE POLICY "Owners manage staff" ON public.reserve_staff
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.reserve_stores s WHERE s.id = store_id AND s.user_id = auth.uid())
  );

-- Policies for reserve_appointments
-- 公開預約與查詢一律走 API（service role），不開放匿名直接讀寫顧客資料
CREATE POLICY "Owners manage appointments" ON public.reserve_appointments
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.reserve_stores s WHERE s.id = store_id AND s.user_id = auth.uid())
  );

-- Policies for reserve_customers
CREATE POLICY "Owners manage customers" ON public.reserve_customers
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.reserve_stores s WHERE s.id = store_id AND s.user_id = auth.uid())
  );

-- Policies for reserve_ai_insights
CREATE POLICY "Owners manage ai insights" ON public.reserve_ai_insights
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.reserve_stores s WHERE s.id = store_id AND s.user_id = auth.uid())
  );
