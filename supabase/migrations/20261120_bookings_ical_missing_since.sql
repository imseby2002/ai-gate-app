-- iCal 偵測：有人工資料的訂單，若事件已從平台 feed 消失（疑似客人取消），標記時間。
-- 系統不自動刪除真實訂單，改由每日偵測報告提醒、日曆顯示「疑似已取消」供一鍵釋出。
alter table public.bookings add column if not exists ical_missing_since timestamptz;
notify pgrst, 'reload schema';
