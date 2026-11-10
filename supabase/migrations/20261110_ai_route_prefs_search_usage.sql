-- 每日比價結果與免費通道可用模型清單（由 /api/cron/model-prices 寫入，AI 呼叫端讀取並快取 1 小時）
CREATE TABLE IF NOT EXISTS public.ai_route_prefs (
  id          TEXT PRIMARY KEY,
  data        JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.ai_route_prefs ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Admins can view ai_route_prefs') THEN
    CREATE POLICY "Admins can view ai_route_prefs" ON public.ai_route_prefs FOR SELECT
      USING (EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.user_type = 'admin'));
  END IF;
END $$;

-- Gemini Google 搜尋免費額度計數（2.5 Flash 每日 1,500 次提問；Gemini 3 每月 5,000 次搜尋）
CREATE TABLE IF NOT EXISTS public.ai_search_usage (
  date       DATE NOT NULL,
  provider   TEXT NOT NULL,
  prompts    INTEGER NOT NULL DEFAULT 0,
  queries    INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (date, provider)
);
ALTER TABLE public.ai_search_usage ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Admins can view ai_search_usage') THEN
    CREATE POLICY "Admins can view ai_search_usage" ON public.ai_search_usage FOR SELECT
      USING (EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.user_type = 'admin'));
  END IF;
END $$;

-- 原子遞增計數，避免同時多個請求互相覆蓋
CREATE OR REPLACE FUNCTION public.increment_ai_search_usage(p_date DATE, p_provider TEXT, p_prompts INTEGER, p_queries INTEGER)
RETURNS VOID LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  INSERT INTO public.ai_search_usage (date, provider, prompts, queries, updated_at)
  VALUES (p_date, p_provider, p_prompts, p_queries, now())
  ON CONFLICT (date, provider) DO UPDATE
    SET prompts = ai_search_usage.prompts + EXCLUDED.prompts,
        queries = ai_search_usage.queries + EXCLUDED.queries,
        updated_at = now();
$$;
REVOKE ALL ON FUNCTION public.increment_ai_search_usage(DATE, TEXT, INTEGER, INTEGER) FROM PUBLIC, anon, authenticated;
