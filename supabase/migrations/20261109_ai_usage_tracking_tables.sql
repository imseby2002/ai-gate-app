-- 建立 universal-tracker 寫入的兩張 AI 用量表（145 / 156 的表格部分；未含 145 的其他 ALTER）
CREATE TABLE IF NOT EXISTS public.ai_source_usage_daily (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE NOT NULL,
  source_channel TEXT NOT NULL CHECK (source_channel IN ('cliproxy','freellm','groq','direct')),
  model_id TEXT NOT NULL,
  message_count INTEGER DEFAULT 0,
  input_tokens BIGINT DEFAULT 0,
  output_tokens BIGINT DEFAULT 0,
  total_cost_usd NUMERIC(10,6) DEFAULT 0,
  saved_cost_usd NUMERIC(10,6) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(date, source_channel, model_id)
);
CREATE INDEX IF NOT EXISTS idx_ai_source_usage_daily_date ON public.ai_source_usage_daily(date);
ALTER TABLE public.ai_source_usage_daily ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Admins can view ai_source_usage_daily') THEN
    CREATE POLICY "Admins can view ai_source_usage_daily" ON public.ai_source_usage_daily FOR SELECT
      USING (EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.user_type = 'admin'));
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.ai_feature_usage_daily (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE NOT NULL,
  feature_module TEXT NOT NULL,
  model_id TEXT NOT NULL,
  source_channel TEXT NOT NULL DEFAULT 'direct',
  request_count INTEGER DEFAULT 0,
  input_tokens BIGINT DEFAULT 0,
  output_tokens BIGINT DEFAULT 0,
  total_cost_usd NUMERIC(10,6) DEFAULT 0,
  saved_cost_usd NUMERIC(10,6) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(date, feature_module, model_id, source_channel)
);
CREATE INDEX IF NOT EXISTS idx_ai_feature_usage_daily_date ON public.ai_feature_usage_daily(date);
CREATE INDEX IF NOT EXISTS idx_ai_feature_usage_daily_module ON public.ai_feature_usage_daily(feature_module);
ALTER TABLE public.ai_feature_usage_daily ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Admins can view ai_feature_usage_daily') THEN
    CREATE POLICY "Admins can view ai_feature_usage_daily" ON public.ai_feature_usage_daily FOR SELECT
      USING (EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.user_type = 'admin'));
  END IF;
END $$;
