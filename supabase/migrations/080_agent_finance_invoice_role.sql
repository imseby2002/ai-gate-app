-- =============================================
-- AI GATE - Migration 080
-- Agent 框架 Phase 3：財務發票/核銷專員（finance-invoice）
-- 重用既有 hr_cashflow 表（出納帳務，owner_id/type/category/amount/receipt_url），
-- 不新建帳務表。OCR 辨識手寫/PDF 發票、ERP 整合暫不在範圍內
-- （這個 SaaS 沒有內建 ERP，需先確認客戶用哪套才能整合）。
-- =============================================

INSERT INTO public.agent_tools (id, label, description, category, default_requires_approval, risk_level) VALUES
  ('list_uncategorized_cashflow', '列出待分類帳務', '列出尚未分類或缺備註的收支紀錄', 'finance', false, 'low'),
  ('update_cashflow_category',    '更新帳務分類',   '更新一筆收支紀錄的分類/備註，會實際寫入帳本', 'finance', true, 'medium')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.agent_roles
  (id, label, description, category, default_model_intent, default_tool_ids, approval_action_types, sort)
VALUES
  (
    'finance-invoice',
    '財務發票/核銷專員',
    '檢視收支紀錄（含已上傳的收據附件），核對是否已正確分類、有無異常金額，建議分類後需真人核准才會真正寫入帳本。' ||
    '目前不含 OCR 自動辨識手寫/PDF 發票內容與 ERP 整合（此平台無內建 ERP）。',
    'finance',
    'finance',
    ARRAY['list_uncategorized_cashflow', 'update_cashflow_category', 'get_company_context', 'read_role_memory', 'write_memory', 'notify_human', 'request_human_approval', 'finish_run'],
    ARRAY['spend_money'],
    50
  )
ON CONFLICT (id) DO NOTHING;
