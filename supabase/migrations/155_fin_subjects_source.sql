-- =============================================
-- AI GATE - Migration 155
-- fin_subjects 增加來源標記，供「清空 MDB 匯入」時一併移除匯入建立之科目
-- =============================================

alter table public.fin_subjects
  add column if not exists source text not null default 'manual'; -- 'manual' | 'zero_import'

-- 既有科目皆由 MDB 匯入建立（帳戶備註「匯入自 Zero」同批）
update public.fin_subjects set source = 'zero_import' where source = 'manual';

notify pgrst, 'reload schema';
