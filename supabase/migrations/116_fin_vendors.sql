-- =============================================
-- AI GATE - Migration 116
-- 出納・門市費用（階段 3）：廠商 + 私密填報連結。
-- 瓦斯＝1 家(涵蓋全部門市)；冰塊＝多家(依區域涵蓋)。
-- 廠商用 fill_token 免登入填報，寫入 fin_bills(source='vendor')。
-- =============================================

create table if not exists public.fin_vendors (
  id         uuid primary key default gen_random_uuid(),
  owner_id   uuid not null references public.profiles(id) on delete cascade,
  name       text not null,
  service    text not null default 'ice' check (service in ('gas', 'ice')),
  regions    text[] not null default '{}',   -- ice 用；空＝全部（gas 一律全部）
  fill_token text not null,
  active     boolean not null default true,
  created_at timestamptz not null default now(),
  unique (owner_id, fill_token)
);
create index if not exists idx_fin_vendors_owner on public.fin_vendors(owner_id);
create unique index if not exists idx_fin_vendors_token on public.fin_vendors(fill_token);

alter table public.fin_vendors enable row level security;
drop policy if exists "fin_vendors_owner" on public.fin_vendors;
create policy "fin_vendors_owner" on public.fin_vendors for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());
drop policy if exists "fin_vendors_admin" on public.fin_vendors;
create policy "fin_vendors_admin" on public.fin_vendors for all using (public.is_admin());
