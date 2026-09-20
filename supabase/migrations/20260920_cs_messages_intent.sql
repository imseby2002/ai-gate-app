alter table cs_messages add column if not exists intent text;
comment on column cs_messages.intent is '這則客人訊息的意圖分類——已知情境（轉真人/退換貨/手動模式/圖片降級等）直接寫死字串，其餘走一般 AI 分類器兜底（見 cs-webhook route.ts classifyGeneralIntent）。用於熱點問題統計/客服績效報表等分析功能。';
