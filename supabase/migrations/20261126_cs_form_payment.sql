-- 自建表單收費：表單可設定「需要收費」，提交紀錄記錄付款狀態（專員按「已付」）與客人回報的匯款資訊
alter table cs_forms add column if not exists requires_payment boolean not null default false;
alter table cs_form_submissions add column if not exists paid_at timestamptz;
alter table cs_form_submissions add column if not exists payment_note text;
