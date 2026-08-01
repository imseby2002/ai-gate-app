-- 房源排序：讓使用者能拖曳調整房源（房號）顯示順序
alter table public.properties
  add column if not exists sort_order integer not null default 0;

-- 既有資料依建立時間補上初始排序值，避免新舊資料混雜時順序不穩定
with ranked as (
  select id, row_number() over (partition by user_id order by created_at asc) - 1 as rn
  from public.properties
)
update public.properties p
set sort_order = ranked.rn
from ranked
where p.id = ranked.id;

create index if not exists idx_properties_sort_order on public.properties (user_id, sort_order);
