-- iCal 同步：記錄上次成功同步的 iCal 內容雜湊，內容沒變就不寫入（降低 Supabase 流量）
alter table public.ical_settings add column if not exists last_ical_hash text;
