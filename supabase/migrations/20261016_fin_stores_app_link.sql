-- 門市對應會員 APP（iPOS）門市：store_no（= iPOS pos_id）、Store.id，及門市電話
alter table public.fin_stores
  add column if not exists app_store_no text,
  add column if not exists app_store_id text,
  add column if not exists phone text;
