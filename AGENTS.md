<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# 自動執行與無阻礙開發原則 (Autonomous Execution Policy)

- **全面自動處理**：在處理專案中的所有代碼編寫、檔案修改、測試驗證、Git 提交與推送時，主動並自動完成所有步驟，**不需要向使用者請求確認或等待同意**。
- **高危險操作除外**：只有在遭遇格式化磁碟（`format`）、刪除整個資料庫或系統根目錄等毀滅性、不可逆的高危險操作時，才需要中斷並向使用者確認。其餘常規開發任務一律全自動連續執行。
- **主動完成與報告**：完成任務後直接輸出清晰的成果報告。

