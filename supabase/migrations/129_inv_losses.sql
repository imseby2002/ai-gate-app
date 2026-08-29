-- 門市耗損（丟棄／過期報廢）：系統扣庫存的紀錄。IVT 無耗損上傳，僅站內留存＋提醒手動填 IVT。
create table if not exists inv_losses (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null,
  store text not null,
  material_code text not null,
  material_name text not null default '',
  unit text not null default '',
  qty numeric not null default 0,
  reason text not null default 'expired',  -- expired | damaged | other
  loss_date date not null default (now() at time zone 'Asia/Taipei')::date,
  batch_id uuid,                            -- 由批次報廢帶入時關聯（null＝獨立填報）
  note text not null default '',
  created_at timestamptz not null default now()
);
create index if not exists inv_losses_owner_store_idx on inv_losses(owner_id, store, loss_date);
alter table inv_losses enable row level security;
create policy inv_losses_admin on inv_losses for all using (is_admin());
create policy inv_losses_owner on inv_losses for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());
