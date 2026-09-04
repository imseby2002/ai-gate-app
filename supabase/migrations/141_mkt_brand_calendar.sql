-- 行銷部門 P1：品牌中樞（品牌資產）＋內容行事曆
-- 品牌檔（每公司一份）：後續 AI 產出內容時作為品牌守則，確保一致且高品質
create table if not exists mkt_brand (
  owner_id uuid primary key,
  name text not null default '',           -- 品牌名稱
  slogan text not null default '',         -- 標語/slogan
  tagline text not null default '',        -- 一句話定位
  colors jsonb not null default '{}'::jsonb, -- { primary, secondary, accent }
  fonts text not null default '',          -- 字型規範
  tone text not null default '',           -- 品牌語氣 tone of voice
  audience text not null default '',       -- 目標客群
  selling_points text not null default '', -- 產品特色/賣點
  banned_words text not null default '',   -- 禁用詞
  brand_story text not null default '',    -- 品牌故事
  logo_url text not null default '',       -- Logo 連結
  updated_at timestamptz not null default now()
);
alter table mkt_brand enable row level security;
create policy mkt_brand_admin on mkt_brand for all using (is_admin());
create policy mkt_brand_owner on mkt_brand for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());

-- 內容行事曆：跨平台檔期規劃（實際 AI 產出＋審核流水線於 P2）
create table if not exists mkt_calendar (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null,
  title text not null,
  channel text not null default 'other',   -- fb | ig | tiktok | zalo | line | store | other
  scheduled_date date,
  status text not null default 'idea',      -- idea | draft | review | scheduled | published
  note text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists mkt_calendar_owner_idx on mkt_calendar(owner_id, scheduled_date);
alter table mkt_calendar enable row level security;
create policy mkt_calendar_admin on mkt_calendar for all using (is_admin());
create policy mkt_calendar_owner on mkt_calendar for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());
