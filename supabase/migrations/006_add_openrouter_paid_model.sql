-- Migration 006: Add OpenRouter paid test model
INSERT INTO public.ai_models
  (id, display_name, provider, modality, input_cost_per_1k, output_cost_per_1k,
   image_cost_per_unit, video_cost_per_sec, context_window, supports_vision,
   supports_files, routing_tags, sort_order)
VALUES
  ('or-gpt-4o-mini', 'GPT-4o Mini (OpenRouter)', 'openrouter', 'text',
   0.00015, 0.0006, 0, 0, 128000, false, false,
   ARRAY['general','fast'], 13)
ON CONFLICT (id) DO NOTHING;
