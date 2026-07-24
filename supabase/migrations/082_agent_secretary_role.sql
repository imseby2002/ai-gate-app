-- =============================================
-- AI GATE - Migration 082
-- Agent 框架：秘書專員（secretary）
-- 使用者需先至 /api/integrations/google-calendar/auth 連結 Google 帳號
-- （沿用 user_integrations 表，provider='google_calendar'，與既有
-- google_drive 連結各自獨立，互不影響）。
-- 不含機票/飯店/餐廳訂位 API 整合，該平台目前無此類第三方串接。
-- =============================================

INSERT INTO public.agent_tools (id, label, description, category, default_requires_approval, risk_level) VALUES
  ('list_calendar_events',  '讀取日曆行程', '讀取 Google 日曆上即將到來的行程', 'secretary', false, 'low'),
  ('create_calendar_event', '建立日曆事件', '在日曆上建立事件（僅限自己的日曆，不通知外部對象）', 'secretary', false, 'low'),
  ('summarize_inbox',       '彙整重要信件', '讀取信箱中重要信件並摘要', 'secretary', false, 'low')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.agent_roles
  (id, label, description, category, default_model_intent, default_tool_ids, approval_action_types, sort)
VALUES
  (
    'secretary',
    '秘書',
    '管理老闆的日曆與收件匣：彙整重要信件、安排/提醒行程、建立會議事件。' ||
    '目前不含機票/飯店/餐廳訂位（無串接第三方訂位 API），僅能提供建議，真人需自行下單。',
    'productivity',
    'daily',
    ARRAY['list_calendar_events', 'create_calendar_event', 'summarize_inbox', 'get_company_context', 'read_role_memory', 'write_memory', 'notify_human', 'request_human_approval', 'finish_run'],
    ARRAY[]::text[],
    140
  )
ON CONFLICT (id) DO NOTHING;
