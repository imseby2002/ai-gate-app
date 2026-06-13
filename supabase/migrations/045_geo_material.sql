-- GEO 素材庫：每位使用者可複用的商家檔案（LocalBusiness Schema）、作者（Person/E-E-A-T）、獨家事實片段
create table if not exists public.geo_material (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  business jsonb,
  authors jsonb not null default '[]',
  facts jsonb not null default '[]',
  updated_at timestamptz not null default now()
);
alter table public.geo_material enable row level security;
drop policy if exists "own geo_material" on public.geo_material;
create policy "own geo_material" on public.geo_material
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
