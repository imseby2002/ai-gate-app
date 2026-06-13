-- GEO 發佈設定：每位使用者自己的 WordPress 憑證 / Webhook（取代 env 寫死）
create table if not exists public.geo_publish_settings (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  wp_base_url text,
  wp_user text,
  wp_app_password text,
  webhook_url text,
  webhook_token text,
  updated_at timestamptz not null default now()
);
alter table public.geo_publish_settings enable row level security;
drop policy if exists "own geo_publish_settings" on public.geo_publish_settings;
create policy "own geo_publish_settings" on public.geo_publish_settings
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
