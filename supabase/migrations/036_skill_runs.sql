-- =============================================
-- AI GATE - Skill Runs & Credit Deduction
-- Migration 036
-- 第一批可執行 skill（行銷文案 / 短影音腳本 / 文章配圖 / 市場研究報告）
-- 紀錄每次執行並以點數（credit_transactions）計價扣款。
-- =============================================

-- ===== SKILL RUN LOG =====
CREATE TABLE public.skill_runs (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  skill_id      TEXT NOT NULL,
  input         JSONB,
  output        TEXT,
  credits_spent NUMERIC(10,4) NOT NULL DEFAULT 0,
  status        TEXT NOT NULL DEFAULT 'success'
                CHECK (status IN ('success', 'error')),
  error         TEXT,
  created_at    TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_skill_runs_user ON public.skill_runs(user_id, created_at DESC);
CREATE INDEX idx_skill_runs_skill ON public.skill_runs(skill_id);

ALTER TABLE public.skill_runs ENABLE ROW LEVEL SECURITY;

-- 使用者只能讀自己的紀錄；admin 可讀全部
CREATE POLICY "skill_runs_own" ON public.skill_runs
  FOR SELECT USING (user_id = auth.uid() OR public.is_admin());

-- admin 可全權管理（寫入主要由 service-role 進行，會略過 RLS）
CREATE POLICY "skill_runs_admin" ON public.skill_runs
  FOR ALL USING (public.is_admin());

-- ===== 原子扣點函式 =====
-- 以 credit_transactions 為真相來源：鎖定該使用者 profile 列以序列化並發扣款，
-- 餘額不足時丟出 INSUFFICIENT_CREDITS，由 API 轉成 402。
CREATE OR REPLACE FUNCTION public.deduct_skill_credits(
  p_user_id     UUID,
  p_amount      NUMERIC,   -- 欲扣除的點數（正數）
  p_description TEXT
)
RETURNS NUMERIC
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_balance     NUMERIC;
  v_new_balance NUMERIC;
BEGIN
  IF p_amount < 0 THEN
    RAISE EXCEPTION 'INVALID_AMOUNT';
  END IF;

  -- 鎖定 profile 列，序列化同一使用者的並發扣款
  PERFORM 1 FROM public.profiles WHERE id = p_user_id FOR UPDATE;

  SELECT COALESCE(SUM(amount_usd), 0) INTO v_balance
  FROM public.credit_transactions
  WHERE user_id = p_user_id;

  IF v_balance < p_amount THEN
    RAISE EXCEPTION 'INSUFFICIENT_CREDITS';
  END IF;

  v_new_balance := v_balance - p_amount;

  INSERT INTO public.credit_transactions
    (user_id, amount_usd, type, description, balance_after)
  VALUES
    (p_user_id, -p_amount, 'usage', p_description, v_new_balance);

  -- 同步快取欄位
  UPDATE public.profiles SET credit_balance = v_new_balance WHERE id = p_user_id;

  RETURN v_new_balance;
END;
$$;
