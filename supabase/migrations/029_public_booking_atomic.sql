-- 029: 公開訂房原子建立（防併發重複預訂）
-- 問題：api/book/[slug] 原本「先查空房再 insert」，併發下會重複預訂；
--       且 bookings 與 public_bookings 為兩張表，單表約束無法跨表防撞。
-- 解法：以 property 為鍵取 transaction advisory lock，序列化同房併發，
--       在同一交易內跨表檢查重疊後才寫入。

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
    -- 同一房型的併發請求在此序列化，直到本交易結束才釋放
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

-- 優惠碼使用次數原子遞增（於 host 確認訂單時呼叫，而非建立 pending 時）
create or replace function increment_promo_use(p_user_id uuid, p_code text)
returns void
language sql
security definer
set search_path = public
as $$
  update promo_codes
     set used_count = coalesce(used_count, 0) + 1
   where user_id = p_user_id and code = p_code;
$$;
