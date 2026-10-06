-- 客服：入住當天未到入住時間時，已核對身份的客人可先取得大門密碼（放行李／在公共區域休息），房門密碼仍於入住時間後才提供。
alter table public.bnb_profiles
  add column if not exists early_gate_access boolean not null default false;
