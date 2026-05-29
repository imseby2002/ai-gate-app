-- 035: bnb_profiles 官網 v2 擴充欄位
alter table bnb_profiles
  add column if not exists template_id          text    default 'natural',
  add column if not exists hero_cta_text        text,
  add column if not exists booking_instructions  text,
  add column if not exists cancellation_policy   text,
  add column if not exists contact_map_embed    text,
  add column if not exists contact_note         text,
  add column if not exists owner_intro          text;
