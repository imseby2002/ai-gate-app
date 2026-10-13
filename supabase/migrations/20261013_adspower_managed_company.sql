-- AdsPower 代管：記錄申請當下切換的公司，開通與續費扣該公司錢包
ALTER TABLE public.marketing_adspower_managed
  ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.companies(id) ON DELETE SET NULL;
