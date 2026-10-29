-- 視訊模式：auto＝有設定 JaaS 就用 JaaS；webrtc＝這場會議強制改用內建視訊（備案，任一參與者可切換）
alter table public.meetings add column if not exists video_mode text not null default 'auto';
alter table public.meetings add constraint meetings_video_mode_check check (video_mode in ('auto', 'webrtc'));
