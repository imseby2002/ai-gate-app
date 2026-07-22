-- =============================================
-- AI GATE - Migration 083
-- Agent 框架：軟體開發專員（code-agent）
-- 範圍限定「提案 PR」：讀程式碼、寫變更、開 draft PR 供真人審查，
-- 不含自動跑測試/自我除錯（此平台為 Vercel serverless，沒有可執行任意
-- 程式碼的沙盒環境，無法安全地自動化測試——測試與最終把關交給既有 CI/真人）。
-- 需設定環境變數 AGENT_GITHUB_TOKEN / AGENT_GITHUB_OWNER / AGENT_GITHUB_REPO
-- （單一、admin 設定的目標倉庫，非每位使用者各自的 GitHub 帳號）。
-- =============================================

INSERT INTO public.agent_tools (id, label, description, category, default_requires_approval, risk_level) VALUES
  ('read_repo_file',      '讀取程式碼', '讀取指定專案中某個檔案的內容', 'dev', false, 'low'),
  ('propose_code_change', '提案程式碼變更', '在新分支提交變更並開 draft PR，會實際修改程式碼倉庫', 'dev', true, 'high')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.agent_roles
  (id, label, description, category, default_model_intent, default_tool_ids, approval_action_types, sort)
VALUES
  (
    'code-agent',
    '軟體開發專員',
    '給予功能需求或問題描述，讀取相關程式碼、撰寫變更，開 draft PR 供真人審查。' ||
    '不含自動跑測試/自我除錯（無沙盒執行環境），測試與最終把關交給既有 CI 或真人。' ||
    '需先由 admin 設定 AGENT_GITHUB_TOKEN/AGENT_GITHUB_OWNER/AGENT_GITHUB_REPO 指定目標倉庫。',
    'dev',
    'analysis',
    ARRAY['read_repo_file', 'propose_code_change', 'get_company_context', 'read_role_memory', 'write_memory', 'notify_human', 'request_human_approval', 'finish_run'],
    ARRAY['modify_codebase'],
    150
  )
ON CONFLICT (id) DO NOTHING;
