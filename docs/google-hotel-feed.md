# Google 訂房連結（Free Booking Links）設定

讓民宿的官方房價直接出現在 Google 地圖／搜尋的訂房模組，旅客點擊後導回本站訂房頁完成預訂。

## 程式端已提供

- 民宿資料新增 `latitude` / `longitude` / `country` / `google_feed_enabled`（migration `051_bnb_google_feed.sql`）
- 訂房後台「民宿資料」頁可填座標、國別並啟用 feed，並顯示兩個 feed 網址
- 兩個 Google 規格 feed endpoint（依民宿 slug）：
  - Hotel List Feed：`/api/book/{slug}/google/hotel-list`
  - Pricing Feed：`/api/book/{slug}/google/pricing`（POST 接收 Google `<Query>`，GET 可瀏覽器檢視未來 60 天最低房價）

整間民宿視為 Google 的「一間飯店」，房價取「該日期區間仍可訂房型中的最低價」（顯示「$X 起」）。

## 上線步驟（需在 Google 後台操作）

1. 先執行 migration `051_bnb_google_feed.sql`
2. 後台「民宿資料」填入緯度/經度（Google 地圖右鍵「這是哪裡？」可取得）、國別、勾選「啟用 Google 房價 feed」並儲存
3. 到 [Google Hotel Center](https://hotelcenter.google.com) 申請帳號
4. 將民宿對應到 Google 商家檔案（Place ID 比對）
5. 在 Hotel Center 設定上述兩個 feed 網址
6. 啟用 **Free Booking Links**（免費、免金流；旅客點房價後導回本站訂房頁）

## 注意

- feed 僅在 `google_feed_enabled=true` 且座標已填時才輸出資料
- Hotel Center 對 XML 格式驗證嚴格，首次上傳請依其驗證訊息微調
- 房價未含稅費（Tax/OtherFees 預設 0），如需另計可再調整 Pricing endpoint
