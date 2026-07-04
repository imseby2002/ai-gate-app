-- CS「找人幫我設定」請求：民宿擁有者不熟悉頻道綁定/知識庫設定時，
-- 送出協助請求並記錄留言，後端寄 email 通知客服人員跟進。
create table if not exists public.cs_setup_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  owner_id uuid not null references public.profiles(id) on delete cascade,
  industry text not null default 'homestay',
  contact text,
  note text,
  status text not null default 'pending', -- pending | contacted | done
  created_at timestamptz not null default now()
);

alter table public.cs_setup_requests enable row level security;

drop policy if exists "own cs_setup_requests" on public.cs_setup_requests;
create policy "own cs_setup_requests" on public.cs_setup_requests
  for select
  using (auth.uid() = user_id);

drop policy if exists "insert own cs_setup_requests" on public.cs_setup_requests;
create policy "insert own cs_setup_requests" on public.cs_setup_requests
  for insert
  with check (auth.uid() = user_id);

create index if not exists cs_setup_requests_owner_idx
  on public.cs_setup_requests (owner_id, created_at desc);
