-- =============================================
-- AI GATE - Migration 135
-- 出納・流水帳：支援匯入 Zero（帳務小管家）記帳軟體資料庫（.mdb）。
-- hr_cashflow 補齊 Zero 對應欄位；新增私有 storage bucket 供使用者
-- 上傳 .mdb（由前端直接上傳，避開 serverless function 的 request body 限制，
-- 伺服器端再從 storage 讀回解析）。
-- =============================================

alter table public.hr_cashflow
  add column if not exists pay_coll_name  text not null default '',  -- 收付對象（Zero: PAY_COLL_NAME）
  add column if not exists invoice_no     text not null default '',  -- 發票號碼（Zero: INVOICE_NO）
  add column if not exists category_parent text not null default '', -- 科目大類（Zero: ITEM_DATA.PARENT_NOTE）
  add column if not exists external_ref   text not null default '',  -- 外部來源唯一鍵（Zero: DATA_KEY），供匯入去重
  add column if not exists source         text not null default 'manual'; -- manual | import | zero_import

create unique index if not exists hr_cashflow_owner_external_ref_uidx
  on public.hr_cashflow(owner_id, external_ref) where external_ref <> '';

-- Zero .mdb 上傳暫存區（私有；匯入完成後由伺服器端刪除）
insert into storage.buckets (id, name, public)
values ('fin-zero-import', 'fin-zero-import', false)
on conflict (id) do nothing;

drop policy if exists "fin-zero-import own" on storage.objects;
create policy "fin-zero-import own" on storage.objects for all
  using (bucket_id = 'fin-zero-import' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'fin-zero-import' and (storage.foldername(name))[1] = auth.uid()::text);
