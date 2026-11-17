-- 公司時區（打卡日期、遲到早退計算）
alter table hr_settings add column if not exists timezone text not null default 'Asia/Ho_Chi_Minh';
