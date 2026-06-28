-- 出納帳務升級為會計式（參考 帳務小管家ZERO）：多帳戶＋結餘、轉帳、收據附件

-- 帳戶表
create table if not exists public.hr_accounts (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  kind text not null default 'cash' check (kind in ('cash','bank','credit','ewallet','other')),
  opening_balance numeric not null default 0,
  currency text not null default 'TWD',
  note text not null default '',
  archived boolean not null default false,
  sort int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.hr_accounts enable row level security;

drop policy if exists "own hr_accounts" on public.hr_accounts;
create policy "own hr_accounts" on public.hr_accounts
  for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

create index if not exists hr_accounts_owner_idx on public.hr_accounts(owner_id);

-- 交易表：加掛帳戶、轉帳目標帳戶、收據
alter table public.hr_cashflow
  add column if not exists account_id uuid references public.hr_accounts(id) on delete set null,
  add column if not exists to_account_id uuid references public.hr_accounts(id) on delete set null,
  add column if not exists receipt_url text not null default '';

-- 放寬 type 允許 transfer（轉帳）
alter table public.hr_cashflow drop constraint if exists hr_cashflow_type_check;
alter table public.hr_cashflow add constraint hr_cashflow_type_check
  check (type in ('income','expense','transfer'));

create index if not exists hr_cashflow_account_idx on public.hr_cashflow(account_id);

-- 收據附件 storage bucket（私有；檔名隨機、依 uid 分資料夾）
insert into storage.buckets (id, name, public)
values ('hr-receipts', 'hr-receipts', true)
on conflict (id) do nothing;

drop policy if exists "hr-receipts read own" on storage.objects;
create policy "hr-receipts read own" on storage.objects for select
  using (bucket_id = 'hr-receipts' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "hr-receipts insert own" on storage.objects;
create policy "hr-receipts insert own" on storage.objects for insert
  with check (bucket_id = 'hr-receipts' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "hr-receipts delete own" on storage.objects;
create policy "hr-receipts delete own" on storage.objects for delete
  using (bucket_id = 'hr-receipts' and (storage.foldername(name))[1] = auth.uid()::text);
