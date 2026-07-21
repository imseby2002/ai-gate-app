-- =============================================
-- AI GATE - Migration 076
-- Agent 框架 Phase 1 試點角色種子資料
-- =============================================

INSERT INTO public.agent_roles
  (id, label, description, category, default_model_intent, default_tool_ids, approval_action_types, sort)
VALUES
  (
    'lead-gen',
    'B2B 潛在名單開發專員',
    '自主搜尋網路與社群平台上的目標企業，評估其規模與需求，彙整報告並撰寫客製化開發信草稿。對外發送前需真人核准。',
    'sales',
    'creative',
    ARRAY['web_search', 'collect_market_data', 'draft_marketing_copy', 'get_company_context', 'read_role_memory', 'write_memory', 'notify_human', 'request_human_approval', 'finish_run'],
    ARRAY['send_external_comms', 'make_call'],
    10
  ),
  (
    'marketing-officer',
    '網路行銷專員',
    '主動搜尋資料、分析市場、規劃內容（文案/配圖/短影音腳本），自我檢討成效並主動回報。廣告投放、對外發布前需真人核准。',
    'marketing',
    'creative',
    ARRAY['web_search', 'collect_market_data', 'analyze_market', 'draft_marketing_copy', 'plan_image_content', 'plan_video_content', 'brainstorm_with_models', 'get_company_context', 'read_role_memory', 'write_memory', 'notify_human', 'request_human_approval', 'finish_run'],
    ARRAY['spend_money', 'send_external_comms'],
    20
  )
ON CONFLICT (id) DO NOTHING;
