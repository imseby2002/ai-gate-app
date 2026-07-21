-- Migration 067: Groq 已於 2026/6/17 棄用 qwen/qwen3-32b，程式端已改指向 qwen/qwen3.6-27b。
-- 這裡只更新顯示名稱，id 保持 groq-qwen3-32b 不變，避免動到既有對話的 model_id 外鍵。

UPDATE public.ai_models
SET display_name = 'Groq Qwen3.6 27B'
WHERE id = 'groq-qwen3-32b';
