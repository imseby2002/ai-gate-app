-- 行銷部門 P2：一鍵整套產出（AI 起草 → 人工審核 → 發布）
create table if not exists mkt_content (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null,
  topic text not null,                       -- 主題／新品
  brief text not null default '',            -- 補充說明
  channels jsonb not null default '[]'::jsonb, -- 選定平台 ["fb","ig",...]
  outputs jsonb not null default '{}'::jsonb,  -- AI 產出（各平台文案＋影片腳本＋圖片提示＋GEO 文章）
  status text not null default 'review',     -- review 待審核 | approved 已核准 | scheduled 已排程 | published 已發布 | rejected 退回
  review_note text not null default '',      -- 審核備註
  model text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists mkt_content_owner_idx on mkt_content(owner_id, status, created_at desc);
alter table mkt_content enable row level security;
create policy mkt_content_admin on mkt_content for all using (is_admin());
create policy mkt_content_owner on mkt_content for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());
