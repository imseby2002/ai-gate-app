# AI-GATE 讀後台連接器（多平台，API 攔截版）

在一台「常開、已登入各平台後台」的電腦上，用瀏覽器外掛**唯讀攔截後台自己打的訂單 API 回應**，
把新訂單／取消推送到 AI-GATE。**不爬畫面、不爬蟲登入、不改請求、不自動操作平台、不自動發文**。

支援平台（各自偵測網域）：
- Booking.com — `admin.booking.com`
- Agoda — `ycs.agoda.com`
- Trip.com / Ctrip — `ebooking.trip.com`、`*.ctrip.com`
- AsiaYo — `expert.asiayo.com`
- Expedia — `apps.expediapartnercentral.com`

解決的痛點：通知信沒房型、iCal 慢又會換 UID——後台 API 有完整的姓名／房號／單號，直接讀最準。

## 為什麼是「攔 API」而不是「爬畫面」
各家後台都是 SPA（React/Vue/微前端），畫面 class 是打包亂碼、改版就變，爬 DOM 很脆弱。
但畫面上的訂單其實是前端打**內部 JSON API**（例：Booking 的 `graphql.json`、`get_reservation_details`；
AsiaYo 的 `host_order_all.js`…）取得的。外掛在頁面環境掛一個**唯讀攔截器**（`inject.js`）side-記下
這些 JSON 回應，再用**通用啟發式**從中找出訂單欄位。比爬畫面穩很多，且多數平台免逐家寫死。

## 架構
```
OTA 後台(已登入) ──內部API JSON──▶ inject.js(唯讀攔截) ──▶ content.js(啟發式解析)
                                                              │
                              background.js ──POST──▶ AI-GATE /api/connector/booking/ingest
                              保活/登出偵測 ◀──────────┘
```

## 安裝（Chrome / Edge，開發者模式）
1. `chrome://extensions` → 開「開發者模式」。
2. 「載入未封裝項目」→ 選 `browser-connector/booking`。
3. 釘選外掛。

## 配對
1. AI-GATE 網頁 → 訂房 → 「讀後台連接器」→「產生配對碼」。
2. 外掛設定頁填「AI-GATE 網址」→ 輸入配對碼 →「配對」。

## 使用
- 在那台電腦開著各平台後台的訂單頁並保持登入。
- 外掛**自動**攔截 API、解析、推送（去重）；新訂單／取消會進系統。
- 背景每 `keepAliveMin` 分鐘刷新保活；偵測到登出→系統通知請你手動重登。
- 手動：在後台訂單頁點外掛「**擷取並推送**」可立即重推。

## 解析規則放伺服器，外掛自動抓（改版免重載外掛）
解析規則集中在伺服器端（`/api/connector/booking/rules`）。外掛啟動、每次保活都會自動抓最新規則並快取。
平台改版時，**開發者只改伺服器端規則重新部署**，使用者端外掛**不用重新下載**，下次保活就自動更新。
（只有外掛本身的程式架構變動，例如新增平台偵測，才需要重發外掛。）

## 改版壞掉時怎麼辦（你只要點一下）
若某平台改版導致**解析到 0 筆**：
1. 在該平台後台訂單頁，點外掛「**匯出樣本**」→ 會下載一個 JSON 檔（含該頁攔到的 API 回應，
   姓名等個資可自行塗改，但**欄位結構要保留**）。
2. 把這個檔案回報給開發者 → 開發者更新伺服器端規則。
3. 更新後，各民宿的外掛會自動抓到新規則，**無需任何人重新下載**。

## 伺服器端
- `POST /api/connector/booking/ingest`（Bearer 裝置 token，支援多平台）：比對房源、去重後寫入
  `bookings`（`source='connector'`）。房型配不到 → 留「房型未定」，可在訂單詳情手動指派。
- 取消：API 狀態為取消 → 系統同步標取消並釋出房況。

## 安全 / 條款
- 唯讀讀取你**自己**已登入後台的 API 回應，不改請求、不點擊、不送表單、不自動發文。
- 仍屬平台條款灰色地帶；風險遠低於自動登入爬蟲，但非官方授權，請自行斟酌。
- Ctrip／Expedia 等有反自動化偵測；本外掛只被動讀回應，不主動發請求，風險較低但非零。
- token 僅存於此瀏覽器 `chrome.storage.local`；可在 AI-GATE 撤銷裝置。

## 檔案
- `inject.js`：頁面環境唯讀攔截 fetch/XHR 的 JSON 回應。
- `content.js`：啟發式解析訂單、去重、推送；處理擷取/匯出/保活/登出。
- `background.js`：推送 ingest、保活 alarm、登出通知。
- `popup.*`：設定、配對、擷取、匯出。
