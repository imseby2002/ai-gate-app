-- 定價規則「允許與其他促銷疊加」欄位：程式（規則儲存、computeStayPrice）早已讀寫 can_stack，
-- 但資料表一直沒有這個欄位——儲存規則會失敗，報價查規則時整批查詢出錯、規則全部被忽略。
alter table public.pricing_rules add column if not exists can_stack boolean not null default false;
notify pgrst, 'reload schema';
