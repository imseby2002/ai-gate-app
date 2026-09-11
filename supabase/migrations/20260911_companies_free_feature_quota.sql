-- feedback_free_features 只能「完全免費不限次數」，太粗；補上每月免費次數上限，
-- 讓公司可以設定「每月前 N 次功能修改免費，超過才要計費」，兩者並存：
-- feedback_free_features=true 優先生效（不限次數）；否則看 quota 是否還沒用完。
ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS free_feature_quota_monthly INTEGER;
