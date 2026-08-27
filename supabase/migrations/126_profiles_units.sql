-- =============================================
-- AI GATE - Migration 126
-- 公司單位入口（基礎）：帳號可存取的單位（功能群）。
-- units 空 = 依現況（各營運頁仍為管理者可用）；之後各群逐步開放為「管理者 or 該單位」。
-- =============================================
alter table public.profiles
  add column if not exists units text[] not null default '{}';
