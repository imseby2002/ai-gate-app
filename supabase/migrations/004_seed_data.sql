-- =============================================
-- AI GATE - Seed Data
-- Migration 004: AI Models
-- =============================================

INSERT INTO public.ai_models
  (id, display_name, provider, modality, input_cost_per_1k, output_cost_per_1k,
   image_cost_per_unit, video_cost_per_sec, context_window, supports_vision,
   supports_files, routing_tags, sort_order)
VALUES
  -- Text Models
  ('deepseek-chat',     'DeepSeek Chat',          'deepseek',   'text',       0.00014,  0.00028,  0, 0, 128000, false, true,  ARRAY['daily','general','chat'],          1),
  ('deepseek-reasoner', 'DeepSeek Reasoner (R1)', 'deepseek',   'text',       0.00055,  0.00219,  0, 0, 64000,  false, false, ARRAY['finance','reasoning','math'],       2),
  ('gemini-2.0-flash',  'Gemini 2.0 Flash',       'google',     'text',       0.000075, 0.0003,   0, 0, 1000000, true, true,  ARRAY['creative','marketing','fast'],      3),
  ('gemini-2.0-flash-thinking', 'Gemini Flash Thinking', 'google', 'text',   0.000075, 0.0003,   0, 0, 1000000, true, true,  ARRAY['creative','marketing'],             4),
  ('claude-opus-4-5',   'Claude Opus 4.5',        'anthropic',  'text',       0.015,    0.075,    0, 0, 200000, true, true,   ARRAY['analysis','deep','complex'],        5),
  ('claude-sonnet-4-5', 'Claude Sonnet 4.5',      'anthropic',  'text',       0.003,    0.015,    0, 0, 200000, true, true,   ARRAY['analysis','balanced'],              6),
  ('perplexity-sonar-pro', 'Perplexity Sonar Pro','perplexity', 'text',       0.001,    0.001,    0, 0, 127000, false, false,  ARRAY['legal','research','web','search'],  7),

  -- Multimodal
  ('gemini-2.0-flash-vision', 'Gemini Vision (OCR/Image)', 'google', 'multimodal', 0.00125, 0.00375, 0, 0, 128000, true, true, ARRAY['vision','ocr','image-analysis'], 8),

  -- Image Generation
  ('flux-1-pro',        'FLUX.1 Pro',             'fal',        'image',      0, 0, 0.05, 0, null, false, false, ARRAY['image-gen','photorealistic'],       9),
  ('nano-banana',       'Nano Banana (Fast)',      'fal',        'image',      0, 0, 0.02, 0, null, false, false, ARRAY['image-gen','fast','cartoon'],        10),

  -- Video Generation
  ('veo3',              'VEO3',                   'veo',        'video',      0, 0, 0, 0.15, null, false, false, ARRAY['video-gen','realistic'],             11),
  ('kling-v2',          'Kling V2',               'kling',      'video',      0, 0, 0, 0.10, null, false, false, ARRAY['video-gen','creative'],              12)
ON CONFLICT (id) DO NOTHING;
