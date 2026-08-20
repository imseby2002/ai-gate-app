-- =============================================
-- AI GATE - Migration 113
-- 智能差異：IVT 進銷存「當月使用量」(lượng dùng tháng) 欄位。
-- 差異分析實耗優先用此欄（門市自填當月使用量），未填才退回 期初＋叫貨−期末。
-- （此欄先前已套用至遠端資料庫，補上 migration 檔以保持 repo 與 DB 一致。）
-- =============================================

alter table public.inv_movements
  add column if not exists usage_month numeric not null default 0;
