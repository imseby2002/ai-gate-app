-- 行銷部門 P3：實體門市行銷（物料配發／地推活動／戶外廣告／異業合作）
create table if not exists mkt_offline (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null,
  type text not null default 'material',   -- material 門市物料 | event 地推活動 | outdoor 戶外廣告 | partner 異業合作
  title text not null,
  store text not null default '',           -- 門市（空＝全公司/總部）
  status text not null default 'planned',   -- planned 規劃 | active 進行中 | installed 已上架/布置 | done 完成 | cancelled 取消
  start_date date,
  end_date date,
  budget numeric not null default 0,        -- 預算/費用
  counterparty text not null default '',    -- 廠商/合作方
  photo_url text not null default '',        -- 上架/布置/存證照片連結
  note text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists mkt_offline_owner_idx on mkt_offline(owner_id, type, status);
create index if not exists mkt_offline_date_idx on mkt_offline(owner_id, start_date);
alter table mkt_offline enable row level security;
create policy mkt_offline_admin on mkt_offline for all using (is_admin());
create policy mkt_offline_owner on mkt_offline for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());
