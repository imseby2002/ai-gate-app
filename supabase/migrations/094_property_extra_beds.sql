-- 房型可設定「可加床數量」與「加床費用」，跟現有的加人費（extra_guest_fee）分開計價，
-- 有些房型即使沒超過原本人數上限，也想加一張床（如加嬰兒床/沙發床）並額外收費。
alter table public.properties
  add column if not exists max_extra_beds int not null default 0,
  add column if not exists extra_bed_fee numeric(10,2);
