-- =============================================
-- AI GATE - Migration 119
-- 門市盤點・訂貨（續）：各門市領班聯絡管道（緊急低於安全量時通知）。
-- =============================================
create table if not exists public.inv_store_contacts (
  id               uuid primary key default gen_random_uuid(),
  owner_id         uuid not null references public.profiles(id) on delete cascade,
  store            text not null,
  foreman_telegram text not null default '',
  foreman_email    text not null default '',
  updated_at       timestamptz not null default now(),
  unique (owner_id, store)
);
create index if not exists idx_inv_store_contacts on public.inv_store_contacts(owner_id, store);

alter table public.inv_store_contacts enable row level security;
drop policy if exists "inv_store_contacts_owner" on public.inv_store_contacts;
create policy "inv_store_contacts_owner" on public.inv_store_contacts for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());
drop policy if exists "inv_store_contacts_admin" on public.inv_store_contacts;
create policy "inv_store_contacts_admin" on public.inv_store_contacts for all using (public.is_admin());
