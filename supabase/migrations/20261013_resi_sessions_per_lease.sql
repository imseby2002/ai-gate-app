-- 住宅代理：每次購買產生的固定 IP 連線數（1–10，管理者設定）；API 金鑰改用環境變數 IPROYAL_RESI_API_TOKEN
ALTER TABLE public.marketing_official_proxies
  ADD COLUMN IF NOT EXISTS sessions_per_lease INTEGER;
