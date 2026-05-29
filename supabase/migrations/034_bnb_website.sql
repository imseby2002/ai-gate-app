-- 034: bnb_profiles 官網擴充欄位
alter table bnb_profiles
  add column if not exists tagline          text,
  add column if not exists about            text,
  add column if not exists social_links     jsonb default '{}',
  add column if not exists faq              jsonb default '[]',
  add column if not exists theme_color      text,
  add column if not exists seo_title        text,
  add column if not exists seo_description  text;
