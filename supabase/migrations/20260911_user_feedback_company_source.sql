-- user_feedback 目前只知道是「哪個 user」送出的，看不出哪家公司、從哪個模組/裝置來——
-- 補上 company_id（比照 profiles.company_id 慣例，送出當下快照，之後就算員工離開公司也留存）
-- 與 source（模組路徑或 'mobile'，前端自行帶入）。
ALTER TABLE public.user_feedback
  ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.companies(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS source TEXT;

CREATE INDEX IF NOT EXISTS idx_user_feedback_company_id ON public.user_feedback(company_id);
