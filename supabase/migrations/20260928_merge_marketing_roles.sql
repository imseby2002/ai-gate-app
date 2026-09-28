-- =============================================
-- 合併重複的「網路行銷專員」角色
-- marketing-officer（舊，只做研究/規劃）與 digital-marketer（新，含目標任務、發文、Meta 廣告）同名；
-- digital-marketer 的工具是 marketing-officer 的超集，保留新的，舊角色停用，已啟用舊角色的使用者改為啟用新角色。
-- =============================================

INSERT INTO public.user_agent_roles (user_id, role_id, enabled, config, credit_budget_monthly, enabled_by)
SELECT u.user_id, 'digital-marketer', true, u.config, u.credit_budget_monthly, u.enabled_by
FROM public.user_agent_roles u
WHERE u.role_id = 'marketing-officer' AND u.enabled
ON CONFLICT (user_id, role_id) DO UPDATE SET enabled = true;

UPDATE public.user_agent_roles SET enabled = false WHERE role_id = 'marketing-officer';

UPDATE public.agent_roles SET status = 'disabled' WHERE id = 'marketing-officer';
