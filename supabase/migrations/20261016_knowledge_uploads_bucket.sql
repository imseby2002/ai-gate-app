-- 公司知識庫大檔上傳：瀏覽器以 signed upload URL 直傳（繞過 Vercel 4.5MB 請求上限），伺服器解析後即刪除
insert into storage.buckets (id, name, public, file_size_limit)
values ('knowledge-uploads', 'knowledge-uploads', false, 52428800)
on conflict (id) do nothing;
