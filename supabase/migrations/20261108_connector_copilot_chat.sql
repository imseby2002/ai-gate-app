-- 桌面連接器新增任務類型 copilot_chat：個人 LINE 電腦版／Zalo 網頁群組帶入文案（發送由使用者自己按）
alter table public.marketing_connector_tasks drop constraint if exists marketing_connector_tasks_type_check;
alter table public.marketing_connector_tasks
  add constraint marketing_connector_tasks_type_check
  check (type in ('sync_profiles', 'open_profile', 'copilot_post', 'copilot_chat'));
