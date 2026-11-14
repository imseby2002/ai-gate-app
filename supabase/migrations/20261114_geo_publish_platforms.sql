-- GEO Writer 發佈到更多平台（Facebook 粉專、Blogger、Medium、Ghost、Notion、Dev.to）的每人設定
-- 結構：{ medium: {token}, ghost: {url, adminKey}, notion: {token, parentPageId}, devto: {apiKey}, blogger: {blogId}, facebook: {} }
-- 憑證只存在伺服器端，GET API 不回傳明文
alter table public.geo_publish_settings
  add column if not exists platforms jsonb not null default '{}'::jsonb;
