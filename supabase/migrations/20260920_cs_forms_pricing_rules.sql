-- 自建表單依欄位答案觸發的加價/折扣規則（例：選了某個房型多收費用、選平日入住折扣）
alter table cs_forms add column if not exists pricing_rules jsonb not null default '[]'::jsonb;
comment on column cs_forms.pricing_rules is '依表單欄位答案觸發的價格調整規則陣列：{id, fieldId, matchValue, adjustmentType, amountType, amount, note}';
