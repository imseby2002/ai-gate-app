# AI-GATE 桌面連接器（Windows）

安裝在客人電腦上，把 AI-GATE「社群矩陣」的帳號與代理自動同步成 AdsPower 設定檔，並接收網頁端任務（一鍵開啟瀏覽器；下一版加入 Copilot 帶入文案）。
發布、互動一律由使用者自己操作；本程式不做無人值守的自動發文或養號。

## 需求
- Windows 10/11
- [Node.js 20 LTS 以上](https://nodejs.org/)
- AdsPower（需可使用 Local API 的方案），並於「設定 → Local API」確認 API 狀態為成功
  - 若 AdsPower 開啟了 API 金鑰驗證，設定環境變數 `ADSPOWER_API_KEY`
  - 若 API 埠不是 50325，設定 `ADSPOWER_API=http://127.0.0.1:<埠>`

## 安裝與配對
1. 下載本資料夾（`desktop-connector/`）
2. AI-GATE 網頁「社群矩陣 → 桌面連接器」按「產生配對碼」
3. 在資料夾內開命令提示字元：
   ```
   npm run pair -- XXXX-XXXX
   npm run status
   ```
4. 雙擊 `start.bat` 常駐執行（或 `npm start`）

## 運作
- 啟動時與每 10 分鐘：讀取 AI-GATE 的社群帳號＋綁定代理 → 在 AdsPower「AI-GATE」群組建立／更新設定檔（一帳號一設定檔、代理自動帶入）→ 回寫設定檔 ID
- 每 5 秒領取網頁任務：同步設定檔、開啟某帳號的瀏覽器
- 設定（含裝置 token）存於 `%APPDATA%\ai-gate-connector\config.json`；網頁端可隨時撤銷此裝置

## AdsPower API 參考
路徑與欄位依 AdsPower 官方 [local-api-mcp-typescript](https://github.com/AdsPower/local-api-mcp-typescript)：
`POST /api/v2/browser-profile/create|update|start|stop`、`GET /api/v1/group/list`、`POST /api/v1/group/create`，每秒限 1 次請求。
