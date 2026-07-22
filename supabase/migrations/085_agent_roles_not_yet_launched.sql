-- =============================================
-- AI GATE - Migration 085
-- Agent 框架：列出但尚未上線的角色（status='disabled'）
-- 這兩個角色列在目錄中，但一般使用者在 /agent 看不到、無法啟用
-- （GET /api/agent/roles 只回傳 status='active' 的角色）；
-- 只有 admin 在 /admin/agents/roles 能看到並之後手動打開。
--
-- secops：需要對客戶自己的伺服器/網路有存取權限，這個 SaaS 目前完全
-- 沒有這類基礎設施掛勾，也不該無授權就去動客戶的伺服器設定。
--
-- iot-maintenance：需要工廠端的感測器資料來源，這個 SaaS 沒有內建
-- IoT 資料擷取層，需要客戶先有自己的感測器系統才能串接。
-- =============================================

INSERT INTO public.agent_roles
  (id, label, description, category, default_model_intent, default_tool_ids, approval_action_types, status, sort)
VALUES
  (
    'secops',
    'IT 維運/SecOps 專員（尚未上線）',
    '【尚未上線】設計目標：偵測伺服器/網路異常、自動判斷威脅等級、封鎖可疑 IP、修正系統設定。' ||
    '目前平台沒有任何客戶伺服器/網路層級的存取權限或監控資料來源，貿然開放會是嚴重的安全風險，需要先由客戶決定要開放哪些系統、什麼權限範圍，才能規劃如何整合。',
    'it',
    'analysis',
    ARRAY[]::text[],
    ARRAY[]::text[],
    'disabled',
    900
  ),
  (
    'iot-maintenance',
    '智慧製造 IoT 預測維護專員（尚未上線）',
    '【尚未上線】設計目標：結合工廠感測器資料，偵測設備異常震動/數值，比對 SOP 庫找出故障代碼，派發維修工單。' ||
    '目前平台沒有內建 IoT 資料擷取層，需要客戶先有自己的感測器/邊緣運算系統，並提供資料介接方式後才能規劃整合。',
    'operations',
    'analysis',
    ARRAY[]::text[],
    ARRAY[]::text[],
    'disabled',
    910
  )
ON CONFLICT (id) DO NOTHING;
