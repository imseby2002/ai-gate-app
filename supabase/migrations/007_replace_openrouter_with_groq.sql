-- Migration 007: Remove OpenRouter free models, add Groq models

-- Clear foreign key references first, then remove deprecated free OpenRouter models
UPDATE public.conversations
SET model_id = NULL
WHERE model_id IN ('or-llama-3.3-70b', 'or-qwen3-80b', 'or-qwen-coder', 'or-gemma-3-27b');

DELETE FROM public.ai_models
WHERE id IN ('or-llama-3.3-70b', 'or-qwen3-80b', 'or-qwen-coder', 'or-gemma-3-27b');

-- Expand provider check constraint to include groq and openrouter
ALTER TABLE public.ai_models
  DROP CONSTRAINT IF EXISTS ai_models_provider_check;

ALTER TABLE public.ai_models
  ADD CONSTRAINT ai_models_provider_check
  CHECK (provider IN ('deepseek','google','anthropic','perplexity','fal','kling','veo','openrouter','groq'));

-- Add Groq models
INSERT INTO public.ai_models
  (id, display_name, provider, modality, input_cost_per_1k, output_cost_per_1k,
   image_cost_per_unit, video_cost_per_sec, context_window, supports_vision,
   supports_files, routing_tags, sort_order)
VALUES
  ('groq-auto',           'Groq Auto（自動選擇）',       'groq', 'text', 0, 0, 0, 0, 128000, false, false, ARRAY['general','fast','auto'],      13),
  ('groq-llama-3.3-70b',  'Groq Llama 3.3 70B',         'groq', 'text', 0, 0, 0, 0, 128000, false, false, ARRAY['general','fast'],             14),
  ('groq-qwen3-32b',      'Groq Qwen3 32B',             'groq', 'text', 0, 0, 0, 0, 32768,  false, false, ARRAY['analysis','chinese'],         15),
  ('groq-deepseek-r1',    'Groq DeepSeek-R1 (70B)',     'groq', 'text', 0, 0, 0, 0, 128000, false, false, ARRAY['reasoning','finance','math'],  16),
  ('groq-qwq-32b',        'Groq QwQ 32B',               'groq', 'text', 0, 0, 0, 0, 32768,  false, false, ARRAY['reasoning','math'],           17)
ON CONFLICT (id) DO NOTHING;
