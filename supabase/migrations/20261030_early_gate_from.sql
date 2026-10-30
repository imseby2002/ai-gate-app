-- 客服：提前提供大門密碼的開放時間（入住當天幾點起可先給大門密碼），預設 08:00。
alter table public.bnb_profiles
  add column if not exists early_gate_from text not null default '08:00';
