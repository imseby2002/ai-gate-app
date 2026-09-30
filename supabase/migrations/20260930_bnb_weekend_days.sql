-- 週末定義改為民宿層級設定（哪幾晚算週末，JS getDay：0=日…6=六，以入住當晚計）。
-- 週末定價規則、每日定價／格狀視圖的週末底色都依此設定。預設週五、週六晚。
alter table public.bnb_profiles add column if not exists weekend_days int[] not null default '{5,6}';

-- 先前週末規則上個別設定過 weekend_days 的，沿用為民宿設定
update public.bnb_profiles bp
set weekend_days = array(select jsonb_array_elements_text(r.conditions->'weekend_days')::int)
from (
  select distinct on (user_id) user_id, conditions
  from public.pricing_rules
  where rule_type = 'weekend' and jsonb_typeof(conditions->'weekend_days') = 'array'
  order by user_id, updated_at desc nulls last
) r
where bp.user_id = r.user_id;

notify pgrst, 'reload schema';
