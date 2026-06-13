-- GEO Writer：追蹤目標網域改為使用者於專案輸入（取代寫死的 env 預設）
alter table public.geo_projects add column if not exists target_domain text;
