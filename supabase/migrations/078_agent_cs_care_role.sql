-- =============================================
-- AI GATE - Migration 078
-- Agent 框架 Phase 2：客戶服務關懷專員（cs-care）
-- =============================================

INSERT INTO public.agent_tools (id, label, description, category, default_requires_approval, risk_level) VALUES
  ('list_dormant_customers', '列出待關心客戶', '列出許久沒互動或多次問價未成交的客戶名單', 'cs', false, 'low'),
  ('send_customer_message',  '發送客戶訊息',   '主動發送訊息給指定客戶，真的會送達客戶手機', 'cs', true,  'high')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.agent_roles
  (id, label, description, category, default_model_intent, default_tool_ids, approval_action_types, sort)
VALUES
  (
    'cs-care',
    '客戶服務關懷專員',
    '主動關心老客戶：找出許久沒互動或多次問價未成交的客戶，評估後草擬關心訊息/折扣建議，經真人核准後才會真正發送給客戶。',
    'cs',
    'daily',
    ARRAY['list_dormant_customers', 'send_customer_message', 'get_company_context', 'read_role_memory', 'write_memory', 'notify_human', 'request_human_approval', 'finish_run'],
    ARRAY['send_external_comms'],
    30
  )
ON CONFLICT (id) DO NOTHING;
