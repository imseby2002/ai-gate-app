-- =============================================
-- AI GATE - Migration 084
-- Agent 框架：門市稽核專員（edge-ai-audit）
-- 範圍限定「收件/報告端」：目前沒有現場攝影機/Jetson 裝置，這裡只做
-- 接收已上傳影像 → AI 判斷違規 → 產出報告的後端邏輯。真人可先手動上傳
-- 照片測試；之後裝了現場設備，只要串接同一支上傳 API 即可銜接，
-- 不需重做這層。
-- =============================================

CREATE TABLE public.agent_compliance_uploads (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  store_name   TEXT,
  image_url    TEXT NOT NULL,
  source       TEXT NOT NULL DEFAULT 'manual' CHECK (source IN ('manual', 'device')),
  analyzed     BOOLEAN NOT NULL DEFAULT false,
  severity     TEXT CHECK (severity IN ('none', 'low', 'medium', 'high')),
  findings     TEXT,
  uploaded_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_agent_compliance_uploads_user ON public.agent_compliance_uploads(user_id, uploaded_at DESC);

ALTER TABLE public.agent_compliance_uploads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "agent_compliance_uploads_own" ON public.agent_compliance_uploads
  FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE POLICY "agent_compliance_uploads_admin" ON public.agent_compliance_uploads
  FOR ALL USING (public.is_admin());

INSERT INTO storage.buckets (id, name, public)
VALUES ('compliance-uploads', 'compliance-uploads', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "compliance-uploads insert own" ON storage.objects;
CREATE POLICY "compliance-uploads insert own" ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'compliance-uploads' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "compliance-uploads read own" ON storage.objects;
CREATE POLICY "compliance-uploads read own" ON storage.objects FOR SELECT
  USING (bucket_id = 'compliance-uploads' AND (storage.foldername(name))[1] = auth.uid()::text);

INSERT INTO public.agent_tools (id, label, description, category, default_requires_approval, risk_level) VALUES
  ('list_recent_uploads',        '列出待分析影像', '列出尚未分析或近期上傳的門市影像', 'compliance', false, 'low'),
  ('analyze_compliance_image',   '分析門市影像違規', '用視覺模型判斷影像中是否有作業違規並寫入結果', 'compliance', false, 'low')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.agent_roles
  (id, label, description, category, default_model_intent, default_tool_ids, approval_action_types, sort)
VALUES
  (
    'edge-ai-audit',
    '門市稽核專員',
    '分析門市上傳的影像，判斷是否有作業違規（如未戴帽子、環境清潔未落實），整理每日合規報告通知店長。' ||
    '目前僅支援手動/既有系統上傳影像分析，尚未接上現場攝影機（需另行採購安裝 NVIDIA Jetson 等邊緣運算裝置後才能即時觸發）。',
    'operations',
    'vision',
    ARRAY['list_recent_uploads', 'analyze_compliance_image', 'get_company_context', 'read_role_memory', 'write_memory', 'notify_human', 'request_human_approval', 'finish_run'],
    ARRAY[]::text[],
    160
  )
ON CONFLICT (id) DO NOTHING;
