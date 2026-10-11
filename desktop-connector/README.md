# AI-GATE 桌面連接器（Windows）

安裝在客人電腦上，把 AI-GATE「社群矩陣」的帳號與代理自動同步成 AdsPower 設定檔，並接收網頁端任務（一鍵開啟瀏覽器、Copilot 帶入文案）。
發布、互動一律由使用者自己操作；本程式不做無人值守的自動發文或養號。

## 需求
- Windows 10/11（不需安裝 Node.js）
- AdsPower 專業版以上（免費版不含 Local API；[推薦註冊連結](https://www.adspower.net/share/TnY8c0)），並於「設定 → Local API」確認 API 狀態為成功
  - 若 AdsPower 開啟了 API 金鑰驗證，設定環境變數 `ADSPOWER_API_KEY`
  - 若 API 埠不是 50325，設定 `ADSPOWER_API=http://127.0.0.1:<埠>`

## 兩種方案
- **方案一：自備 AdsPower**：客人自行註冊訂閱（專業版以上），設定檔建在本機「AI-GATE」分組（不存在時自動建立）
- **方案二：AI-GATE 代管 AdsPower**：客人在網頁申請 → 管理員在 AdsPower 團隊後台建立成員帳號與專屬分組（預設 `AIGATE-<客人編號前 8 碼>`），只授權該分組並開啟 API 權限 → 到 AI-GATE 後台「AdsPower 代管帳號」填入帳號密碼並開通。客人用成員帳號登入 AdsPower 後，連接器只會使用該分組，不自行建立分組

## 安裝與配對（客人）
1. AI-GATE 網頁「社群矩陣 → 帳號」區塊按「下載連接器（Windows）」，取得 `AI-GATE-Connector.exe`
2. 雙擊執行（未簽章，若出現 SmartScreen 請點「其他資訊 → 仍要執行」）
3. 網頁按「產生配對碼」，在連接器視窗輸入 `XXXX-XXXX`，之後會自動常駐執行；下次雙擊即直接啟動

## 打包（開發者）
- `main` 上 `desktop-connector/**` 有變更時，GitHub Actions（`.github/workflows/desktop-connector.yml`）在 Windows 打包並上傳到 Release `connector-latest`
- 本機：`npm install && npm run build:exe` → `dist/AI-GATE-Connector.exe`（Node 22 [Single Executable Applications](https://nodejs.org/api/single-executable-applications.html)）
- 原始碼執行：`node src/index.mjs`（或 `pair <code>`／`run`／`status`），需 Node.js 22+

## 運作
- 啟動時與每 10 分鐘：讀取 AI-GATE 的社群帳號＋綁定代理 → 在 AdsPower「AI-GATE」群組建立／更新設定檔（一帳號一設定檔、代理自動帶入）→ 回寫設定檔 ID
- 每 5 秒領取網頁任務：同步設定檔、開啟某帳號的瀏覽器
- Copilot 帶入（網頁「發文」頁的「在電腦帶入」）：開啟該帳號的 AdsPower 瀏覽器 → 以 CDP（`ws.puppeteer`）新開目標社團分頁 → 文案寫入剪貼簿；使用者自行貼上（Ctrl+V）並按「發布」
- 設定（含裝置 token）存於 `%APPDATA%\ai-gate-connector\config.json`；網頁端可隨時撤銷此裝置

## AdsPower API 參考
路徑與欄位依 AdsPower 官方 [local-api-mcp-typescript](https://github.com/AdsPower/local-api-mcp-typescript)：
`POST /api/v2/browser-profile/create|update|start|stop`、`GET /api/v1/group/list`、`POST /api/v1/group/create`，每秒限 1 次請求。
