-- 安全修正：把 deduct_skill_credits 鎖成只有 service_role 可執行。
--
-- 此函式為 SECURITY DEFINER，會直接寫入 credit_transactions 扣點。原本 PUBLIC
-- 有 EXECUTE，代表任何 anon/authenticated 使用者都能打
-- POST /rest/v1/rpc/deduct_skill_credits 帶任意 p_user_id / p_amount 操弄他人點數。
--
-- 全專案唯一呼叫點是 src/lib/skills/billing.ts，且以 admin（service_role）client 呼叫，
-- 因此撤銷 PUBLIC/anon/authenticated 的 EXECUTE 不影響任何功能。
-- 相對地 get_credit_balance 有 authenticated 呼叫點（layout/chat/roundtable），故不在此鎖定。

REVOKE EXECUTE ON FUNCTION public.deduct_skill_credits(uuid, numeric, text) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.deduct_skill_credits(uuid, numeric, text) TO service_role;
