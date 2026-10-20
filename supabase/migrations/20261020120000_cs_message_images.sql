-- 客人傳到 LINE / WhatsApp / Telegram 的圖片：存在私有 bucket，cs_messages.image_path 記錄路徑，收件匣以簽名網址顯示
alter table public.cs_messages add column if not exists image_path text;

insert into storage.buckets (id, name, public)
values ('cs-media', 'cs-media', false)
on conflict (id) do nothing;
