-- =============================================
-- AI GATE - Migration 145
-- 總管理 AI Token 使用量與成本核算中心：擴充 FreeLLM 與 CLIProxy 來源渠道與模型註冊
-- =============================================

-- 1. 擴充 ai_models provider 檢查條件，新增 cliproxy 與 freellm 代理管道
ALTER TABLE public.ai_models
  DROP CONSTRAINT IF EXISTS ai_models_provider_check;

ALTER TABLE public.ai_models
  ADD CONSTRAINT ai_models_provider_check
  CHECK (provider IN ('deepseek','google','anthropic','perplexity','fal','kling','veo','openrouter','groq','cliproxy','freellm'));

-- 2. 放寬 messages 與 usage_daily 之外鍵約束，允許儲存動態與代理模型
ALTER TABLE public.messages
  DROP CONSTRAINT IF EXISTS messages_model_id_fkey;

ALTER TABLE public.usage_daily
  DROP CONSTRAINT IF EXISTS usage_daily_model_id_fkey;

-- 3. 擴充 messages 與 usage_daily 之來源渠道欄位
ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS source_channel VARCHAR(30) DEFAULT 'direct';

ALTER TABLE public.usage_daily
  ADD COLUMN IF NOT EXISTS source_channel VARCHAR(30) DEFAULT 'direct';

-- 4. 註冊 CLIProxy 與 FreeLLM 免費代理模型至 ai_models 表
INSERT INTO public.ai_models
  (id, display_name, provider, modality, input_cost_per_1k, output_cost_per_1k,
   image_cost_per_unit, video_cost_per_sec, context_window, supports_vision,
   supports_files, routing_tags, sort_order)
VALUES
  -- CLIProxy 免費代理模型 (Copilot / Kiro / Grok)
  ('cliproxy-gemini-3-flash',  'Gemini 3 Flash (CLIProxy 免費)',  'cliproxy', 'text', 0, 0, 0, 0, 1048576, true,  true,  ARRAY['general','fast','free','cliproxy'],  30),
  ('cliproxy-kimi-k2.5',       'Kimi K2.5 (CLIProxy 免費)',       'cliproxy', 'text', 0, 0, 0, 0, 131072,  false, true,  ARRAY['reasoning','math','free','cliproxy'],31),
  ('cliproxy-gpt-5.4-mini',    'GPT-5.4 Mini (CLIProxy 免費)',    'cliproxy', 'text', 0, 0, 0, 0, 128000,  false, true,  ARRAY['general','fast','free','cliproxy'],  32),
  ('cliproxy-grok-3-mini',     'Grok 3 Mini (CLIProxy 免費)',     'cliproxy', 'text', 0, 0, 0, 0, 131072,  false, false, ARRAY['fast','free','cliproxy'],            33),
  ('cliproxy-gpt-5.5',         'GPT-5.5 (CLIProxy 免費)',         'cliproxy', 'text', 0, 0, 0, 0, 200000,  false, true,  ARRAY['analysis','deep','free','cliproxy'], 34),
  ('cliproxy-kimi-k2',         'Kimi K2 (CLIProxy 免費)',         'cliproxy', 'text', 0, 0, 0, 0, 131072,  false, false, ARRAY['creative','free','cliproxy'],        35),
  ('cliproxy-gemini-2.5-pro',  'Gemini 2.5 Pro (CLIProxy 免費)',  'cliproxy', 'text', 0, 0, 0, 0, 1048576, true,  true,  ARRAY['analysis','free','cliproxy'],        36),

  -- FreeLLM 免費代理模型 (12 平台聚合)
  ('freellm-llama-3.3-70b',    'Llama 3.3 70B (FreeLLM 免費)',    'freellm',  'text', 0, 0, 0, 0, 128000,  false, false, ARRAY['general','free','freellm'],          40),
  ('freellm-glm-4.7-flash',    'GLM 4.7 Flash (FreeLLM 免費)',    'freellm',  'text', 0, 0, 0, 0, 128000,  false, false, ARRAY['fast','free','freellm'],             41),
  ('freellm-qwen3-32b',        'Qwen 3 32B (FreeLLM 免費)',        'freellm',  'text', 0, 0, 0, 0, 32768,   false, false, ARRAY['chinese','free','freellm'],          42),
  ('freellm-auto',             'Auto 智能分流 (FreeLLM 免費)',     'freellm',  'text', 0, 0, 0, 0, 128000,  false, false, ARRAY['auto','free','freellm'],             43)
ON CONFLICT (id) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  provider     = EXCLUDED.provider,
  is_enabled   = true;

-- 5. 建立來源日統計專用匯總表 ai_source_usage_daily
CREATE TABLE IF NOT EXISTS public.ai_source_usage_daily (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date            DATE NOT NULL,
  source_channel  TEXT NOT NULL CHECK (source_channel IN ('cliproxy','freellm','groq','direct')),
  model_id        TEXT NOT NULL,
  message_count   INTEGER DEFAULT 0,
  input_tokens    BIGINT DEFAULT 0,
  output_tokens   BIGINT DEFAULT 0,
  total_cost_usd  NUMERIC(10,6) DEFAULT 0,
  saved_cost_usd  NUMERIC(10,6) DEFAULT 0,
  created_at      TIMESTAMPTZ DEFAULT now(),
  UNIQUE(date, source_channel, model_id)
);

CREATE INDEX IF NOT EXISTS idx_ai_source_usage_daily_date ON public.ai_source_usage_daily(date);
CREATE INDEX IF NOT EXISTS idx_ai_source_usage_daily_channel ON public.ai_source_usage_daily(source_channel);

ALTER TABLE public.ai_source_usage_daily ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view ai_source_usage_daily"
  ON public.ai_source_usage_daily FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() AND profiles.user_type = 'admin'
    )
  );
