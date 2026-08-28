-- 門市層級通知對象：管理／稽核／辦公室（領班 foreman_* 已存在）。
alter table inv_store_contacts add column if not exists mgmt_telegram text not null default '';
alter table inv_store_contacts add column if not exists mgmt_email text not null default '';
alter table inv_store_contacts add column if not exists audit_telegram text not null default '';
alter table inv_store_contacts add column if not exists audit_email text not null default '';
alter table inv_store_contacts add column if not exists office_telegram text not null default '';
alter table inv_store_contacts add column if not exists office_email text not null default '';
