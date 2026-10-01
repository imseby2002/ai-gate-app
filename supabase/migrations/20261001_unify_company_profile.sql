-- 公司資料整併：單一來源
--   公司 / 品牌 → mkt_brand（新增公司基本欄位與素材檔）
--   門市       → fin_stores (+ mkt_store_profiles)
--   產品       → mkt_product_profiles
-- 舊 company_data.data（設定頁 / 行銷流水線各自填的一份）搬進主檔後不再寫入；
-- company_data 只保留 compiled_md 相容快取。

alter table if exists public.mkt_brand
  add column if not exists industry  text  not null default '',
  add column if not exists employees text  not null default '',
  add column if not exists capital   text  not null default '',
  add column if not exists founded   text  not null default '',
  add column if not exists address   text  not null default '',
  add column if not exists files     jsonb not null default '[]'::jsonb;

-- 每家公司（owner）挑一筆來源：owner 本人的優先，否則最近更新的成員資料
create temporary table _cd_src as
select distinct on (owner_id) owner_id, data
from (
  select coalesce(o.member_id, cd.user_id) as owner_id,
         cd.data,
         (cd.user_id = coalesce(o.member_id, cd.user_id)) as is_owner,
         cd.updated_at
  from public.company_data cd
  left join public.profiles p on p.id = cd.user_id
  left join public.company_members o
    on o.company_id = p.company_id and o.role = 'owner' and o.status = 'active'
  where cd.data is not null and cd.data <> '{}'::jsonb
) s
where exists (select 1 from public.profiles pp where pp.id = s.owner_id)
order by owner_id, is_owner desc, updated_at desc nulls last;

-- 1) 公司 / 品牌：只補空白欄位，不覆蓋已在品牌中樞填好的內容
insert into public.mkt_brand (owner_id) select owner_id from _cd_src
on conflict (owner_id) do nothing;

update public.mkt_brand b set
  name           = case when b.name = ''           then coalesce(s.data->>'companyName', '')          else b.name end,
  industry       = case when b.industry = ''       then coalesce(s.data->>'industry', '')             else b.industry end,
  employees      = case when b.employees = ''      then coalesce(s.data->>'employees', '')            else b.employees end,
  capital        = case when b.capital = ''        then coalesce(s.data->>'capital', '')              else b.capital end,
  founded        = case when b.founded = ''        then coalesce(s.data->>'founded', '')              else b.founded end,
  address        = case when b.address = ''        then coalesce(s.data->>'address', '')              else b.address end,
  brand_story    = case when b.brand_story = ''    then coalesce(s.data->>'description', '')          else b.brand_story end,
  audience       = case when b.audience = ''       then coalesce(s.data->>'targetAudience', '')       else b.audience end,
  tone           = case when b.tone = ''           then coalesce(s.data->>'brandTone', '')            else b.tone end,
  selling_points = case
    when b.selling_points = '' then concat_ws(E'\n\n',
      nullif(s.data->>'competitiveAdvantage', ''),
      case when coalesce(s.data->>'products', '') <> '' then '主要產品 / 服務：' || (s.data->>'products') end)
    else b.selling_points end,
  platforms      = case
    when coalesce(b.platforms->>'website', '') = '' and coalesce(s.data->>'website', '') <> ''
    then b.platforms || jsonb_build_object('website', s.data->>'website')
    else b.platforms end,
  files          = case
    when b.files = '[]'::jsonb and jsonb_typeof(s.data->'files') = 'array' then s.data->'files'
    else b.files end,
  updated_at     = now()
from _cd_src s
where b.owner_id = s.owner_id;

-- 2) 門市：僅對尚無任何門市主檔的公司匯入舊分店清單
with src as (
  select s.owner_id, br.value as br, br.ordinality as n
  from _cd_src s
  cross join lateral jsonb_array_elements(
    case when jsonb_typeof(s.data->'branches') = 'array' then s.data->'branches' else '[]'::jsonb end
  ) with ordinality as br(value, ordinality)
  where not exists (select 1 from public.fin_stores f where f.owner_id = s.owner_id)
    and coalesce(br.value->>'name', '') <> ''
), ins as (
  insert into public.fin_stores (owner_id, code, name, address, unit_type)
  select owner_id, 'B' || lpad(n::text, 2, '0'), br->>'name', coalesce(br->>'address', ''), 'store'
  from src
  on conflict (owner_id, code) do nothing
  returning id, owner_id, code
)
insert into public.mkt_store_profiles (owner_id, store_id, story)
select ins.owner_id, ins.id,
       concat_ws('；',
         case when coalesce(src.br->>'phone', '') <> '' then '電話：' || (src.br->>'phone') end,
         nullif(src.br->>'notes', ''))
from ins
join src on src.owner_id = ins.owner_id and 'B' || lpad(src.n::text, 2, '0') = ins.code
where coalesce(src.br->>'phone', '') <> '' or coalesce(src.br->>'notes', '') <> ''
on conflict (owner_id, store_id) do nothing;

drop table if exists _cd_src;
