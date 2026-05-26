-- 030: 公開訂房撞期檢查納入 blocked_dates
-- 問題：業者手動封鎖（維修/自用，寫入 blocked_dates）不會擋公開訂房，
--       客人仍可訂到業者關閉的日期。此處在原子函式內加入 blocked_dates 檢查。

create or replace function create_public_booking(
  p_host_user_id   uuid,
  p_property_id    uuid,
  p_check_in       date,
  p_check_out      date,
  p_guest_name     text,
  p_guest_email    text,
  p_guest_phone    text,
  p_num_guests     integer,
  p_total_price    numeric,
  p_promo_code     text,
  p_promo_discount numeric,
  p_notes          text
)
returns public_bookings
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public_bookings;
begin
  if p_check_out <= p_check_in then
    raise exception 'INVALID_DATES';
  end if;

  if p_property_id is not null then
    perform pg_advisory_xact_lock(hashtext(p_property_id::text)::bigint);

    if exists (
      select 1 from public_bookings
      where property_id = p_property_id
        and status in ('pending','confirmed')
        and check_in < p_check_out and check_out > p_check_in
    ) or exists (
      select 1 from bookings
      where property_id = p_property_id
        and status in ('pending','confirmed')
        and check_in < p_check_out and check_out > p_check_in
    ) or exists (
      -- 業者手動/iCal 封鎖日（維修、自用、外部平台）
      select 1 from blocked_dates
      where property_id = p_property_id
        and date >= p_check_in and date < p_check_out
    ) then
      raise exception 'DATE_CONFLICT';
    end if;
  end if;

  insert into public_bookings (
    host_user_id, property_id, guest_name, guest_email, guest_phone,
    num_guests, check_in, check_out, total_price, promo_code, promo_discount,
    notes, status, payment_method
  ) values (
    p_host_user_id, p_property_id, p_guest_name, p_guest_email, p_guest_phone,
    coalesce(p_num_guests, 1), p_check_in, p_check_out, p_total_price,
    p_promo_code, p_promo_discount, p_notes, 'pending', 'on_arrival'
  )
  returning * into v_row;

  return v_row;
end;
$$;
