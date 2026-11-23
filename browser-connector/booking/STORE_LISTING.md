# Chrome Web Store 上架資料（私密／Unlisted）

打包好的上傳檔：`browser-connector/dist/aigate-connector-store.zip`
（zip 根目錄即為 manifest.json，符合 Chrome Web Store 要求。）

---

## 基本資訊

- **名稱**：AI-GATE 讀後台連接器
- **類別**：Workflow & Planning（工作流程）
- **語言**：繁體中文
- **可見度**：**Unlisted（不公開）** — 不會被搜尋到，只有拿到安裝連結的人可安裝。

## 簡短說明（132 字內）
把已登入的 OTA 後台（Booking/Agoda/Trip/AsiaYo/Expedia）訂單，唯讀同步到自己的 AI-GATE 訂房系統。不爬蟲登入、不自動操作平台。

## 詳細說明
AI-GATE 讀後台連接器供民宿經營者在自己常開、已登入各訂房平台後台的電腦上，唯讀讀取後台訂單頁的內部 API 回應（訂單編號、姓名、房型、入住/退房日期、人數、金額、狀態），把新訂單與取消即時同步到自己的 AI-GATE 訂房管理系統。

解決痛點：平台通知信常缺房號、iCal 同步慢又會換 UID；後台 API 有完整資料，直接讀最準。

特色：
- 唯讀，不自動登入爬蟲、不代送表單、不自動發文或互動。
- 支援 Booking.com、Agoda、Trip.com/Ctrip、AsiaYo、Expedia。
- 解析規則由伺服器端提供，平台改版時免重新安裝外掛。
- 偵測後台登出會通知使用者手動重登。

本外掛僅供使用者同步「自己」已登入後台的訂單資料到「自己」的系統，不蒐集、不販售、不用於廣告。

## 隱私權政策網址
https://booking.im-tourist.com/connector/privacy.html

## 單一用途說明（Single purpose）
唯讀讀取使用者自己已登入的訂房平台後台所顯示的訂單資料，並同步到使用者自己的 AI-GATE 訂房系統，協助集中管理訂單。

## 權限理由（Permission justifications）
- **storage**：儲存 AI-GATE 網址、裝置權杖與使用者設定。
- **alarms**：定時溫和重新整理後台頁面以維持登入狀態（保活）。
- **notifications**：偵測到後台登出時通知使用者手動重新登入。
- **tabs**：判斷目前分頁是否為支援平台的後台訂單頁，以便正確擷取。
- **host permissions（各 OTA 後台 + *.im-tourist.com）**：讀取後台訂單 API 回應並推送到使用者自己的 AI-GATE 系統。
- **遠端程式碼**：不使用。解析規則為資料（JSON），非可執行程式碼。

## 資料使用揭露（Data usage，須於後台勾選）
- 蒐集的資料類型：**個人可識別資訊**（訂房人姓名）、**其他**（訂單編號、房型、日期、金額、狀態）。
- 用途：僅用於提供此外掛的核心功能（同步到使用者自己的系統）。
- 不販售或轉讓給第三方；不用於與核心功能無關之用途；不用於判斷信用度或放貸。
- 傳輸加密：是（HTTPS）。

## 上架素材
- 圖示 128×128：`browser-connector/booking/icons/icon128.png`
- 截圖 1280×800 或 640×400：至少 1 張（建議：連接器頁面 + 外掛 popup）。**需自行截圖補上。**

---

## 更新流程
平台改版多數只需改伺服器端規則（免動外掛）。若外掛程式本身要更新：
1. 改 `browser-connector/booking/`，bump `manifest.json` version。
2. 重新打包（見 `build-store-zip.sh`）。
3. Chrome Web Store 開發者後台上傳新 zip → 審核通過後自動推送更新給所有安裝者。
