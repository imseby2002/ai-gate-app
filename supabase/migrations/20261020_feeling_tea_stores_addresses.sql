-- =============================================
-- Migration: Update FEELING TEA store names to full address names
-- Ensure fin_stores and pos_stores do not use short abbreviations
-- =============================================

-- 1. Update fin_stores with the full address names based on store codes or previous transliterated names
update public.fin_stores
set 
  name = v.address_name,
  address = case when coalesce(address, '') = '' then v.address_name else address end,
  short_name = v.address_name
from (values
  ('YL', '61 Yên Lãng'),
  ('DC', '20 Đội Cấn'),
  ('NL', '162 Ngọc Lâm'),
  ('HBT', '53C Hai Bà Trưng'),
  ('MK', '406 Minh Khai'),
  ('RN', 'Royal Nguyễn Trãi'),
  ('TTT', '4 Trần Thái Tông'),
  ('QT', '169 Quang Trung'),
  ('KH', '22 Khương Hạ'),
  ('HTM', '217 Hồ Tùng Mậu'),
  ('GV', '155 Giảng Võ'),
  ('KT', '219C Khâm Thiên'),
  ('CL', '163 Chùa Láng'),
  ('TKC', '422 Trần Khát Chân'),
  ('NH', '137 Ngọc Hồi'),
  ('TM', '128 Tân Mai'),
  ('TN', '11 Thanh Niên'),
  ('CG', '45 Cầu Gỗ'),
  ('BM', '307C Bạch Mai'),
  ('PNT', '100 Phạm Ngọc Thạch')
) as v(code, address_name)
where upper(public.fin_stores.code) = upper(v.code)
   or public.fin_stores.name ilike '%' || v.code || '%'
   or public.fin_stores.short_name ilike '%' || v.code || '%';

-- 2. Update pos_stores if they match any store codes or old transliterated names
update public.pos_stores
set name = v.address_name
from (values
  ('YL', '61 Yên Lãng'),
  ('DC', '20 Đội Cấn'),
  ('NL', '162 Ngọc Lâm'),
  ('HBT', '53C Hai Bà Trưng'),
  ('MK', '406 Minh Khai'),
  ('RN', 'Royal Nguyễn Trãi'),
  ('TTT', '4 Trần Thái Tông'),
  ('QT', '169 Quang Trung'),
  ('KH', '22 Khương Hạ'),
  ('HTM', '217 Hồ Tùng Mậu'),
  ('GV', '155 Giảng Võ'),
  ('KT', '219C Khâm Thiên'),
  ('CL', '163 Chùa Láng'),
  ('TKC', '422 Trần Khát Chân'),
  ('NH', '137 Ngọc Hồi'),
  ('TM', '128 Tân Mai'),
  ('TN', '11 Thanh Niên'),
  ('CG', '45 Cầu Gỗ'),
  ('BM', '307C Bạch Mai'),
  ('PNT', '100 Phạm Ngọc Thạch')
) as v(code, address_name)
where upper(public.pos_stores.slug) = lower(v.code)
   or upper(public.pos_stores.name) = upper(v.code);
