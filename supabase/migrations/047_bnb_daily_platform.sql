-- 每日入住：帶入訂單平台（booking_com / agoda / trip_com / asiayo ...），前端顯示平台縮寫
alter table bnb_daily_records add column if not exists platform text;
