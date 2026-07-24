-- =============================================
-- AI GATE - Migration 081
-- Agent 框架第三批角色：全部重用既有工具，不需新增 agent_tools
-- =============================================

INSERT INTO public.agent_roles
  (id, label, description, category, default_model_intent, default_tool_ids, approval_action_types, sort)
VALUES
  (
    'researcher',
    '研究員',
    '針對指定主題做深度研究：搜尋多方資料、交叉比對、去蕪存菁，輸出結構化簡報或表格。也可主動研究公司前景並提出建議。',
    'research',
    'analysis',
    ARRAY['web_search', 'brainstorm_with_models', 'get_company_context', 'read_role_memory', 'write_memory', 'notify_human', 'request_human_approval', 'finish_run'],
    ARRAY[]::text[],
    60
  ),
  (
    'rnd',
    '研發專員',
    '針對公司需要的方向做研發分析：蒐集內外部資料、分析各種可能組合與呈現方式。可設定是否需考慮客戶感受或只需深入研究。',
    'research',
    'analysis',
    ARRAY['web_search', 'collect_market_data', 'brainstorm_with_models', 'get_company_context', 'read_role_memory', 'write_memory', 'notify_human', 'request_human_approval', 'finish_run'],
    ARRAY[]::text[],
    70
  ),
  (
    'accountant',
    '會計審核專員',
    '分析會計申報、主動查詢該國會計法規找出更節稅的方法、檢查財務資料是否吻合。僅產出建議與草稿，不會自動送出任何申報或款項。',
    'finance',
    'finance',
    ARRAY['web_search', 'get_company_context', 'read_role_memory', 'write_memory', 'notify_human', 'request_human_approval', 'finish_run'],
    ARRAY[]::text[],
    80
  ),
  (
    'pr',
    '公關專員',
    '主動與媒體/KOL/KOC 溝通關係維護、草擬新聞稿與問題應對說明。所有對外發送（含專屬折扣）一律需真人核准，目前無媒體聯絡清單資料來源，聯絡對象需真人提供。',
    'marketing',
    'creative',
    ARRAY['web_search', 'draft_marketing_copy', 'get_company_context', 'read_role_memory', 'write_memory', 'notify_human', 'request_human_approval', 'finish_run'],
    ARRAY['send_external_comms'],
    90
  ),
  (
    'project-marketing',
    '專案行銷專員',
    '主動規劃行銷專案（如網紅合作、新包裝與故事），可用多 AI 針對主題腦力激盪評估可行性。聯絡網紅/廠商、簽約等對外或有財務影響的動作一律需真人核准。',
    'marketing',
    'creative',
    ARRAY['web_search', 'brainstorm_with_models', 'draft_marketing_copy', 'get_company_context', 'read_role_memory', 'write_memory', 'notify_human', 'request_human_approval', 'finish_run'],
    ARRAY['spend_money', 'sign_contract', 'send_external_comms'],
    100
  ),
  (
    'sales-intake',
    '業務接單專員',
    '接收客戶詢價需求（LINE/Email），依公司產品資料主動報價與折扣建議。真正回覆/報價給客戶前需真人核准。',
    'cs',
    'daily',
    ARRAY['draft_marketing_copy', 'send_customer_message', 'get_company_context', 'read_role_memory', 'write_memory', 'notify_human', 'request_human_approval', 'finish_run'],
    ARRAY['send_external_comms'],
    110
  ),
  (
    'product-visual',
    '產品形象專員',
    '規劃產品/品牌形象的配圖與短影音內容腳本，分析後可建議真人該拍攝哪些角度/素材。目前僅產出腳本與拍攝建議，尚未接上真人自動生圖生影片。',
    'marketing',
    'creative',
    ARRAY['plan_image_content', 'plan_video_content', 'get_company_context', 'read_role_memory', 'write_memory', 'notify_human', 'request_human_approval', 'finish_run'],
    ARRAY[]::text[],
    120
  ),
  (
    'procurement',
    '採購供應鏈專員',
    '協助尋找供應商、比價、彙整報價。下採購訂單前需真人核准。目前平台無內建庫存資料，庫存預警自動觸發需先串接客戶自己的庫存系統，暫時只能由真人手動交辦任務啟動。',
    'finance',
    'analysis',
    ARRAY['web_search', 'get_company_context', 'read_role_memory', 'write_memory', 'notify_human', 'request_human_approval', 'finish_run'],
    ARRAY['spend_money'],
    130
  )
ON CONFLICT (id) DO NOTHING;
