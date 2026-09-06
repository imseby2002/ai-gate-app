-- 行銷部門 P4：外送平台經營（GrabFood／ShopeeFood／Baemin…）
create table if not exists mkt_delivery (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null,
  platform text not null default 'grab',    -- grab | shopee | baemin | other
  store text not null default '',
  status text not null default 'online',     -- online 上架中 | offline 已下架 | pending 待上架 | suspended 停權
  url text not null default '',              -- 店家頁連結
  commission_rate numeric not null default 0, -- 佣金率 %
  rating numeric not null default 0,          -- 評分
  ranking integer,                            -- 分類排名
  period text not null default '',            -- 指標月份 yyyy-mm
  monthly_orders integer not null default 0,  -- 當月訂單數
  monthly_revenue numeric not null default 0, -- 當月營業額
  promo text not null default '',             -- 進行中活動
  note text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists mkt_delivery_owner_idx on mkt_delivery(owner_id, platform, store);
alter table mkt_delivery enable row level security;
create policy mkt_delivery_admin on mkt_delivery for all using (is_admin());
create policy mkt_delivery_owner on mkt_delivery for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());
