-- 客服訂房模式：manual＝客服只建立待確認申請（保留房間），由真人客服最後回覆；
-- ai＝客服確認後直接寫入正式訂單（待付款）。
alter table public.bnb_profiles
  add column if not exists cs_booking_mode text not null default 'manual';

do $$ begin
  alter table public.bnb_profiles
    add constraint bnb_profiles_cs_booking_mode_check check (cs_booking_mode in ('manual', 'ai'));
exception when duplicate_object then null; end $$;
