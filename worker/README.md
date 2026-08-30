# ai-gate-worker（獨立自動化 worker）

在**另一台 VM**（非主 app 部署）執行的瀏覽器自動化 worker。各部門需要的「登入外部系統上傳/下載」任務都掛在這裡，用 `tasks/` 分檔擴充。

> 主 app（`src/`）不含、也不得含瀏覽器自動化；本目錄是唯一例外（見根目錄 CLAUDE.md）。

## 第一個任務：IVT 上傳（盤點／訂貨）
主 app 產生的 IVT 匯入檔（`盤點・訂貨` 頁的「IVT 盤點／IVT 訂貨」下載）交給此 worker 代上傳到 `ivt.ipos.vn`。

## VM 建置（Ubuntu 22.04，1 vCPU/1GB 即可）
```bash
# Node 20
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# 取得本目錄（git clone 專案或只複製 worker/），然後
cd worker
cp .env.example .env      # 填入 IVT 帳密（.env 不會進版控）
npm install               # 會自動 npx playwright install chromium
sudo npx playwright install-deps   # 安裝 headless Chromium 系統相依
```

## 執行
兩種取檔方式：

**手動檔**（自己先從主 app 下載 IVT 盤點/訂貨檔）：
```bash
node run.mjs ivt-upload --page stock-taking   --file /path/IVT盤點_YL_2026-08-29.xlsx
node run.mjs ivt-upload --page purchase-order --file /path/IVT訂貨_YL_2026-08-29.xlsx
```

**自動取檔**（worker 直接向主 app 抓「該門市最新盤點」的 IVT 檔，免手動下載）：
```bash
node run.mjs ivt-upload --page stock-taking   --store YL
node run.mjs ivt-upload --page purchase-order --store YL
```
需在 `.env` 設 `APP_BASE_URL` 與 `WORKER_SECRET`；**主 app 端**另需設環境變數：
- `WORKER_SECRET`（與此處相同的共用密鑰）
- `WORKER_OWNER_ID`（公司 owner 的 profile id，決定抓誰的資料）

成功／失敗會輸出一行 JSON；失敗時於 `out/` 存錯誤截圖。

## 首次上線一定要做（重要）
本 worker 的登入與上傳**選擇器是預設猜測**，因為開發時無法連到 IVT 實際畫面。第一次請：
1. 先設 `HEADLESS=false` 跑一次，肉眼看流程停在哪。
2. 若卡住，打開 IVT 對應頁，用瀏覽器「檢查元素」取得正確選擇器，覆寫到 `.env`：
   - 登入：`IVT_SEL_USERNAME` / `IVT_SEL_PASSWORD` / `IVT_SEL_SUBMIT`
   - 上傳：`IVT_SEL_IMPORT_OPEN` / `IVT_SEL_FILE_INPUT` / `IVT_SEL_CONFIRM`
3. 跑到成功後把 `HEADLESS` 設回 `true`，即可排程（cron）或由主 app 觸發。

## 排程（選用）
```bash
# 每天 03:10 上傳某固定檔（範例）
10 3 * * * cd /opt/ai-gate-app/worker && node run.mjs ivt-upload --page stock-taking --file /data/latest-count.xlsx >> /var/log/ivt.log 2>&1
```

## 擴充其他部門任務
在 `tasks/` 新增 `xxx.mjs`（export `run(args)`），並在 `run.mjs` 的 `TASKS` 註冊即可共用同一台 VM。
