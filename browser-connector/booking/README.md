# AI-GATE 讀後台連接器（原型，多平台）

在一台「常開、已登入各平台後台」的電腦上，用瀏覽器外掛**唯讀**讀取訂單列表，
把新訂單／取消推送到 AI-GATE。**不爬蟲登入、不自動操作平台、不自動發文**。

支援平台（各自偵測網域）：
- Booking.com — `admin.booking.com`
- Agoda — `ycs.agoda.com`
- Trip.com / Ctrip — `ebooking.trip.com`、`*.ctrip.com`
- AsiaYo — `expert.asiayo.com`
- Expedia — `apps.expediapartnercentral.com`

解決的痛點：Booking.com 通知信沒房型、iCal 慢又會換 UID——後台頁面有完整的
姓名／房號／單號，直接讀最準。

## 架構
```
Booking.com 後台(已登入) ──讀DOM──▶ content.js ──▶ background.js ──POST──▶ AI-GATE
                                                           │                /api/connector/booking/ingest
                                      保活/登出偵測 ◀───────┘
```

## 安裝（Chrome / Edge，開發者模式載入）
1. 開 `chrome://extensions`，右上「開發者模式」開啟。
2. 「載入未封裝項目」→ 選本資料夾 `browser-connector/booking`。
3. 釘選外掛，點圖示開設定。

## 配對
1. 在 AI-GATE 網頁 → 訂房 → 「讀後台連接器」頁，按「產生配對碼」（10 分鐘有效），
   也可在同頁看到／撤銷已配對裝置。
2. 外掛設定頁填「AI-GATE 網址」→ 輸入配對碼 → 按「配對」。成功後顯示「已配對 ✓」。

## 使用
- 在那台電腦開著 Booking.com 後台的「訂單列表」頁並保持登入。
- content.js 每 30 秒讀一次列表，內容有變才推送（去重）。
- 背景每 `keepAliveMin` 分鐘叫列表頁重新整理一次（保活，避免逾時登出）。
- 偵測到被導回登入頁／出現密碼框／「session expired」→ 發系統通知請你手動重登。

## ⚠️ 需要微調選擇器（重要）
`content.js` 的 `PLATFORM_SELECTORS` 內**每個平台各一組**選擇器，都是「起始猜測」，
**一定要依該平台實際後台版面調整**：
1. 在該平台後台打開訂單列表頁，F12 → Elements。
2. 找到「每一筆訂單的列」元素 → 更新該平台的 `row`。
3. 對照每欄（單號/姓名/房型/入住/退房/金額/狀態）填入相對子選擇器。
4. 存檔後在 `chrome://extensions` 按外掛的「重新整理」。
- 各平台後台會改版，壞掉時回來重調對應平台那一組即可。

## 伺服器端
- `POST /api/connector/booking/ingest`（Bearer 裝置 token）：比對房源、去重後寫入 `bookings`
  （`source='connector'`）。房型配不到 → 留「房型未定」，可在訂單詳情手動指派。
- 取消：後台狀態為「已取消」→ 系統同步標取消並釋出房況。

## 安全 / 條款
- 唯讀讀取你**自己**已登入的後台資料，不自動點擊、不送表單、不自動發文。
- 仍屬平台條款灰色地帶；風險遠低於自動登入爬蟲，但非官方授權，請自行斟酌。
- token 僅存於此瀏覽器的 `chrome.storage.local`；可在 AI-GATE 撤銷裝置。

## 待辦（原型之後）
- 網頁端加「產生配對碼 / 裝置管理」UI。
- Agoda、Trip.com 各自的 content script（版面不同，各一支解析器）。
- 更穩的新訂單差異偵測（記住已送單號，只送新的）。
