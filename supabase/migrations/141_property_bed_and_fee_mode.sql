-- 141: 加床類型、底價含人數、收費模式
-- properties: extra_bed_type (single/double), base_guests, extra_fee_mode (by_guest/by_bed)
-- bookings:   extra_beds (加床數)

alter table public.properties
  add column if not exists extra_bed_type  text not null default 'single'
    check (extra_bed_type in ('single', 'double')),
  add column if not exists base_guests     int  not null default 2,
  add column if not exists extra_fee_mode  text not null default 'by_guest'
    check (extra_fee_mode in ('by_guest', 'by_bed'));

-- base_guests 不能超過 max_guests
-- （業務限制：底價含人數不可大於最大入住人數，避免設定矛盾）
-- 不加 DB constraint，改在應用層驗證，保持彈性。

alter table public.bookings
  add column if not exists extra_beds int not null default 0;

comment on column public.properties.extra_bed_type  is '加床類型：single（單人床）/ double（雙人床）';
comment on column public.properties.base_guests     is '底價含幾人，第 base_guests+1 人起才收 extra_guest_fee';
comment on column public.properties.extra_fee_mode  is '收費模式：by_guest（看人頭）/ by_bed（看加床數）';
comment on column public.bookings.extra_beds        is '本次訂房加幾張床';
