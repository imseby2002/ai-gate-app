-- ============================================================
-- 022: 修正 email 匯入訂單的 property_id
-- ============================================================

-- 1. 對於「用戶只有一個啟用房源」的情況，把 email 訂單的 null property_id 補上
UPDATE bookings b
SET property_id = (
  SELECT p.id
  FROM properties p
  WHERE p.user_id = b.user_id
    AND p.status = 'active'
  LIMIT 1
)
WHERE b.property_id IS NULL
  AND b.source = 'email'
  AND (
    SELECT COUNT(*) FROM properties p2
    WHERE p2.user_id = b.user_id
      AND p2.status = 'active'
  ) = 1;

-- 2. 刪除 null property_id 的 email 重複訂單（若已有 iCal 版本存在）
DELETE FROM bookings a
WHERE a.source = 'email'
  AND a.property_id IS NULL
  AND EXISTS (
    SELECT 1 FROM bookings b
    WHERE b.user_id    = a.user_id
      AND b.platform   = a.platform
      AND b.check_in   = a.check_in
      AND b.check_out  = a.check_out
      AND b.property_id IS NOT NULL
      AND b.id        != a.id
  );
