-- 新考卷預設不在交卷後顯示答案（答案只給檢查人在成績頁看；需要時再手動勾選開放）
alter table public.exams alter column reveal_answers set default false;
