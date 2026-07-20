-- Migration 065: Add low-cost Groq models for CS free-tier evaluation
-- llama-3.1-8b-instant 與 gpt-oss-20b，用於測試繁中客服語氣與成本

INSERT INTO public.ai_models
  (id, display_name, provider, modality, input_cost_per_1k, output_cost_per_1k,
   image_cost_per_unit, video_cost_per_sec, context_window, supports_vision,
   supports_files, routing_tags, sort_order)
VALUES
  ('groq-llama-3.1-8b',  'Groq Llama 3.1 8B',   'groq', 'text', 0, 0, 0, 0, 128000, false, false, ARRAY['general','fast','cheap'], 18),
  ('groq-gpt-oss-20b',   'Groq GPT-OSS 20B',    'groq', 'text', 0, 0, 0, 0, 128000, false, false, ARRAY['general','cheap'],        19)
ON CONFLICT (id) DO NOTHING;
