-- CS「客製功能需求」與「問題反映」請求：與 cs_setup_requests（找人幫我設定）分開，
-- 因為性質不同——客製功能需計價（依方案分級），問題反映純粹是回報，不涉及費用。
-- 用同一張表＋type 欄位區分，避免兩套幾乎一樣的表/API/後台頁面。
create table if not exists public.cs_support_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  owner_id uuid not null references public.profiles(id) on delete cascade,
  type text not null check (type in ('feature', 'feedback')),
  contact text,
  note text not null,
  plan_at_request text, -- 送出當下的方案快照，客製功能計價與日後降級補收差額判斷用
  price_usd numeric, -- 僅 type='feature' 時填值（依方案分級的基礎客製價）；問題反映一律為 null
  status text not null default 'pending', -- pending | contacted | done
  created_at timestamptz not null default now()
);

alter table public.cs_support_requests enable row level security;

drop policy if exists "own cs_support_requests" on public.cs_support_requests;
create policy "own cs_support_requests" on public.cs_support_requests
  for select
  using (auth.uid() = user_id);

drop policy if exists "insert own cs_support_requests" on public.cs_support_requests;
create policy "insert own cs_support_requests" on public.cs_support_requests
  for insert
  with check (auth.uid() = user_id);

create index if not exists cs_support_requests_owner_idx
  on public.cs_support_requests (owner_id, created_at desc);
