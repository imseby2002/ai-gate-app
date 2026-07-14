-- 菜單圖片 Storage（公開讀取）
insert into storage.buckets (id, name, public)
values ('pos-menu', 'pos-menu', true)
on conflict (id) do nothing;
