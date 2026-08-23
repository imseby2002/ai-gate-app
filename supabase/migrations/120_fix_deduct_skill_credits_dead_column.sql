-- deduct_skill_credits() 最後一行寫入 profiles.credit_balance，但正式環境 profiles 表
-- 根本沒有這個欄位（get_credit_balance 一律用 SUM(credit_transactions.amount_usd) 計算，
-- 從不讀這個欄位）。實測 postgres_logs 已抓到 "column \"credit_balance\" does not exist"
-- 的錯誤，且 credit_transactions 從未出現過任何一筆 type='usage' 的紀錄——代表這支 RPC
-- 從來沒有成功扣過款，每次呼叫都在最後一步噴例外、整筆交易 rollback（含前面已 INSERT
-- 的扣款紀錄），但呼叫端把非 INSUFFICIENT_CREDITS 的錯誤當成 reason:'error' 放行，導致
-- 使用者拿到結果卻沒被扣點。移除這行死欄位寫入，其餘邏輯不變。

create or replace function public.deduct_skill_credits(p_user_id uuid, p_amount numeric, p_description text)
returns numeric
language plpgsql
security definer
set search_path to 'public'
as $function$
DECLARE
  v_balance     NUMERIC;
  v_new_balance NUMERIC;
BEGIN
  IF p_amount < 0 THEN
    RAISE EXCEPTION 'INVALID_AMOUNT';
  END IF;

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

  RETURN v_new_balance;
END;
$function$;
