-- 損益表科目樹改為「每人可自訂」：原本寫死於 pnl-schema.ts，改存資料庫。
-- 首次進入業績報表時由 API 以 pnl-schema.ts 的 DEFAULT_PNL_LINES 種入該使用者的科目。
-- 值仍以 line_code（文字）存於 pnl_entries，改科目不影響既有數字。

create table if not exists public.pnl_lines (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  code text not null,                       -- 科目碼（與 pnl_entries.line_code 對應）
  zh text not null default '',              -- 中文名
  vi text not null default '',              -- 越文名
  section text not null default '',         -- 分區標籤（供 sumSection 公式用）
  kind text not null default 'detail'
    check (kind in ('revenue','detail','subtotal','compare')),
  compute jsonb,                            -- 小計計算規則（kind=subtotal 時），null=可錄入
  sort int not null default 0,              -- 報表由上而下的列順序
  archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_id, code)
);

alter table public.pnl_lines enable row level security;
drop policy if exists "own pnl_lines" on public.pnl_lines;
create policy "own pnl_lines" on public.pnl_lines
  for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);
create index if not exists pnl_lines_owner_idx on public.pnl_lines(owner_id, sort);
