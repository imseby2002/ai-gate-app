-- 房型 iCal 匯出：每間房一組不可猜的 token，產生公開 .ics 連結供 OTA 訂閱自動關房
alter table public.properties
  add column if not exists ical_export_token uuid not null default gen_random_uuid();
create unique index if not exists properties_ical_export_token_key
  on public.properties (ical_export_token);
notify pgrst, 'reload schema';
