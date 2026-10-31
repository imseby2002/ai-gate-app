-- 意見反映的客製工時：已指定等級的企業版以「每月客製工時」計算免費額度（PRO 4 小時、MAX 10 小時）。
-- 管理者可填實際工時；未填時每件以 1 小時計（src/lib/company/enterprise-plans.ts 的 ENTERPRISE_FEEDBACK_DEFAULT_HOURS）。
alter table public.user_feedback
  add column if not exists custom_hours numeric check (custom_hours >= 0);
