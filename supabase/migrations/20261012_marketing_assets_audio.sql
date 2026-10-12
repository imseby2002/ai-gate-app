-- 電話行銷 TTS 語音檔（ElevenLabs mp3）上傳到 marketing-assets：補上音訊 MIME 類型
update storage.buckets
set allowed_mime_types = (
  select array(select distinct unnest(coalesce(allowed_mime_types, '{}') || array['audio/mpeg', 'audio/mp3', 'audio/wav']))
)
where id = 'marketing-assets';
