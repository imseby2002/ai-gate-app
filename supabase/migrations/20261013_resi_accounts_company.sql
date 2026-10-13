-- 住宅代理子帳號隸屬購買時的公司（右上角切換）；同一使用者在不同公司各自一個子帳號、各自流量與扣款
ALTER TABLE public.marketing_resi_accounts
  ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.companies(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_marketing_resi_accounts_user_company ON public.marketing_resi_accounts(user_id, company_id);
