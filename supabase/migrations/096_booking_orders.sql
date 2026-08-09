-- 使用者反映：一張訂單訂多個房型時，系統只靠共用的 platform_booking_id（文字欄位）
-- 軟性把多筆 bookings 列串起來，沒有真正的父層「訂單」實體，導致訂單詳情頁、
-- 取消/刪除操作都只能一筆一筆分開做（PR #154 的「同單號列表」只是暫時補丁）。
-- 這裡新增 booking_orders 當作真正的訂單主表（旅客資訊、單號、備註等整單共用
-- 欄位），bookings 轉型成「房型明細」子表，用 order_id 外鍵指回父表。
--
-- 這一步只新增資料表/欄位並回填既有資料，不改動任何現有讀寫邏輯——
-- order_id 暫時保留 nullable，等所有寫入路徑（email-sync、日曆加入訂單等）
-- 改成同時建立 order 之後，才會在後續 migration 加上 NOT NULL。

create table public.booking_orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  platform text not null default 'manual',
  platform_booking_id text,
  guest_name text,
  guest_email text,
  guest_phone text,
  guest_gender text,
  guest_birthday date,
  guest_id_number text,
  guest_address text,
  payment_type text default 'channel',
  arrival_time text,
  currency text default 'TWD',
  deposit_amount numeric,
  is_paid boolean not null default false,
  special_requests text,
  notes text,
  source text default 'manual',
  promo_code text,
  promo_discount numeric,
  extras jsonb default '{}'::jsonb,
  raw_data jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 同一位房東、同一平台、同一個訂單號只會有一筆訂單（沒有單號的手動訂單則不限制，
-- 每筆各自成一張訂單）。
create unique index booking_orders_user_platform_pbid_key
  on public.booking_orders (user_id, platform, platform_booking_id)
  where platform_booking_id is not null;

alter table public.booking_orders enable row level security;

create policy booking_orders_acl_sel on public.booking_orders
  for select using (user_id in (select accessible_owner_ids()));
create policy booking_orders_acl_ins on public.booking_orders
  for insert with check (user_id in (select writable_owner_ids()));
create policy booking_orders_acl_upd on public.booking_orders
  for update using (user_id in (select writable_owner_ids()))
  with check (user_id in (select writable_owner_ids()));
create policy booking_orders_acl_del on public.booking_orders
  for delete using (user_id in (select writable_owner_ids()));

alter table public.bookings
  add column order_id uuid references public.booking_orders(id) on delete cascade;

create index idx_bookings_order_id on public.bookings(order_id);

-- 回填 1：有單號的房型明細，同一 (user_id, platform, platform_booking_id) 群組成一筆
-- 訂單（旅客資訊等取該群組裡最早建立那筆的值，多房型訂單通常本來就共用同一組
-- 旅客資訊）。
with grouped as (
  select distinct on (user_id, platform, platform_booking_id)
    user_id, platform, platform_booking_id, guest_name, guest_email, guest_phone,
    guest_gender, guest_birthday, guest_id_number, guest_address,
    payment_type, arrival_time, currency, deposit_amount, is_paid,
    special_requests, notes, source, promo_code, promo_discount, extras, raw_data,
    created_at, updated_at
  from public.bookings
  where platform_booking_id is not null
  order by user_id, platform, platform_booking_id, created_at asc
),
inserted as (
  insert into public.booking_orders (
    user_id, platform, platform_booking_id, guest_name, guest_email, guest_phone,
    guest_gender, guest_birthday, guest_id_number, guest_address,
    payment_type, arrival_time, currency, deposit_amount, is_paid,
    special_requests, notes, source, promo_code, promo_discount, extras, raw_data,
    created_at, updated_at
  )
  select * from grouped
  returning id, user_id, platform, platform_booking_id
)
update public.bookings b
set order_id = i.id
from inserted i
where b.platform_booking_id is not null
  and b.user_id = i.user_id and b.platform = i.platform and b.platform_booking_id = i.platform_booking_id;

-- 回填 2：沒有單號的房型明細，每一筆各自成一張獨立訂單。用暫時欄位
-- legacy_booking_id 記住是從哪一筆 bookings 來的，回填完就丟掉。
alter table public.booking_orders add column legacy_booking_id uuid;

with new_orders as (
  insert into public.booking_orders (
    user_id, platform, platform_booking_id, guest_name, guest_email, guest_phone,
    guest_gender, guest_birthday, guest_id_number, guest_address,
    payment_type, arrival_time, currency, deposit_amount, is_paid,
    special_requests, notes, source, promo_code, promo_discount, extras, raw_data,
    created_at, updated_at, legacy_booking_id
  )
  select
    user_id, platform, null, guest_name, guest_email, guest_phone,
    guest_gender, guest_birthday, guest_id_number, guest_address,
    payment_type, arrival_time, currency, deposit_amount, is_paid,
    special_requests, notes, source, promo_code, promo_discount, extras, raw_data,
    created_at, updated_at, id
  from public.bookings
  where platform_booking_id is null
  returning id as order_id, legacy_booking_id
)
update public.bookings b
set order_id = no.order_id
from new_orders no
where b.id = no.legacy_booking_id;

alter table public.booking_orders drop column legacy_booking_id;
