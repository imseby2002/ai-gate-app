-- ============================================================
-- 024: 房型平台別名（name_aliases）
-- ============================================================

-- name_aliases: 各平台的英文/外語名稱，如 ["Sea View Double Room", "标准海景大床房"]
alter table properties add column if not exists name_aliases text[] not null default '{}';
