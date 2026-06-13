-- GEO Writer：每個專案是否啟用「每週自動引用追蹤」（預設關閉，由使用者開啟）
alter table public.geo_projects add column if not exists auto_track boolean not null default false;
