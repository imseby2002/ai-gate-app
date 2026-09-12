-- =============================================
-- AI GATE - Migration 148
-- 擴充公用事業（電力公司、水公司）與區域瓦斯廠商填報支援
-- 1. 電費、水費：單一公用事業公司（EVN、水局），一鍵產生專屬填報連結，涵蓋全門市/工廠/辦公室。
-- 2. 瓦斯：多家瓦斯公司，依區域劃分負責門市，填報端僅顯示該廠商負責之門市，並支援瓦斯簽收單/發票單據上傳。
-- 3. 門市端與出納端亦皆可直接填報與上傳單據憑證。
-- =============================================

-- 解除 fin_vendors 服務別舊有約束，擴充 electric (電力) 與 water (水費)
alter table public.fin_vendors drop constraint if exists fin_vendors_service_check;
alter table public.fin_vendors alter column service set default '';
alter table public.fin_vendors add constraint fin_vendors_service_check check (service in ('gas', 'ice', 'electric', 'water', ''));

-- 確保費用科目關聯對應
update public.fin_expense_categories set vendor_service = 'electric' where code in ('ELEC', 'ELECTRIC') and (vendor_service = '' or vendor_service is null);
update public.fin_expense_categories set vendor_service = 'water' where code = 'WATER' and (vendor_service = '' or vendor_service is null);
update public.fin_expense_categories set vendor_service = 'gas' where code = 'GAS' and (vendor_service = '' or vendor_service is null);
update public.fin_expense_categories set vendor_service = 'ice' where code = 'ICE' and (vendor_service = '' or vendor_service is null);
