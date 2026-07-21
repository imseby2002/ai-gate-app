-- Migration 066: 免費層老闆升級提示紀錄
-- 客人傳照片 / 提出客訴時，免費方案未開放 AI 進階處理，記一筆讓 CS 工作台顯示升級提示橫幅。

CREATE TABLE IF NOT EXISTS public.cs_upgrade_nudges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reason text NOT NULL CHECK (reason IN ('image', 'complaint')),
  customer_message text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cs_upgrade_nudges_user_created
  ON public.cs_upgrade_nudges (user_id, created_at DESC);

ALTER TABLE public.cs_upgrade_nudges ENABLE ROW LEVEL SECURITY;

-- 寫入一律用 service role（webhook/cs-chat 後端），此處只開放擁有者讀取自己的提示
CREATE POLICY "cs_upgrade_nudges_select_own" ON public.cs_upgrade_nudges
  FOR SELECT USING (auth.uid() = user_id);
