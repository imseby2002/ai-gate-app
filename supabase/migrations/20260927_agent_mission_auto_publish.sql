-- =============================================
-- Agent 目標任務：發文／Meta 廣告的「逐筆審核 → 自動」開關
-- 預設關閉：每篇發文、每筆廣告都先送真人審核；確認運作正常後由真人在任務頁開啟
-- =============================================

ALTER TABLE public.agent_missions
  ADD COLUMN IF NOT EXISTS auto_publish BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS auto_ads     BOOLEAN NOT NULL DEFAULT false;

INSERT INTO public.agent_tools (id, label, description, category, default_requires_approval, risk_level) VALUES
  ('generate_marketing_image', 'AI 行銷配圖',   '生成行銷配圖，供發文或廣告素材使用',                               'marketing', false, 'low'),
  ('publish_to_social',        '社群發文',      '沿用行銷自動化上傳功能發文；任務未開自動發文時逐篇審核',           'marketing', false, 'high'),
  ('meta_ads_insights',        'Meta 廣告成效', '讀取 Meta 廣告觸及、曝光、花費',                                   'marketing', false, 'low'),
  ('meta_ads_launch',          'Meta 廣告投放', '建立並上線觸及型廣告；任務未開自動投放時逐筆審核，受預算上限控管', 'marketing', false, 'high'),
  ('meta_ads_pause',           'Meta 廣告暫停', '暫停廣告活動、停止花費',                                           'marketing', false, 'low')
ON CONFLICT (id) DO NOTHING;

UPDATE public.agent_roles
SET default_tool_ids = ARRAY(
  SELECT DISTINCT unnest(default_tool_ids || ARRAY['generate_marketing_image','publish_to_social','meta_ads_insights','meta_ads_launch','meta_ads_pause'])
)
WHERE id = 'digital-marketer';
