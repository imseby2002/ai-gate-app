-- AI 對話助理可引用公司知識庫（knowledge_docs）
alter table public.assistants add column if not exists knowledge_doc_ids uuid[] not null default '{}';
