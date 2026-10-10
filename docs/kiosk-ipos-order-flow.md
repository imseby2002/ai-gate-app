# 舊會員 APP（FeelingTea）點單流程與 iPOS API 規格

> 來源：`imseby2002/old-order-system`（commit `81d435e`）。以下路徑都相對於 `feelingtea-appbackend-v1/application/`。
> 用途：給自助點單機（Kiosk）開發參考。

## 0. 系統概況

| 項目 | 內容 | 出處 |
|---|---|---|
| 後端 | Python Sanic + PostgreSQL（SQLAlchemy/Alembic）+ Redis | `README.md` |
| POS | iPOS（Foodbook xpartner API，越南） | `controllers/*` 內 `FOODBOOK_*` |
| 金流 | MoMo（captureWallet）；VNPAY 只在程式裡設了狀態旗標，沒有串接 | `mobile_api/payment_controller.py`、`mobile_api/order_api.py:645` |
| 會員錢包 | HEOVANG（點數 point）、FTCOIN（coin） | `mobile_api/order_api.py:160-182` |
| 前端 | React Web（`feelingtea-web-app`）、React Native（`feelingtea-mobile-app`） | |

**缺少的設定：** repo 裡沒有 `application/config/`。以下設定值要向原廠商要，或到正式機的 `/etc/production.env` 查（`crontab_sync_item.sh` 會 source 這個檔案）：
`FOODBOOK_URL`、`FOODBOOK_URL_PARTNER`、`FOODBOOK_ACCESS_TOKEN`、`FOODBOOK_POS_PARENT`（品牌 ID）、`MOMO_URL`、`PARTNER_CODE_MOMO`、`ACCESS_KEY_MOMO`、`SECRET_KEY_MOMO`、`IPN_URL_MOMO`

---

## 1. 完整流程

```
[同步] iPOS 門市 / 菜單  ──cron──▶  本地 DB (Store / Items / ItemCategory)
                                          │
[1] 選門市、取菜單   GET /app/api/v1/item_categories?store_id=
[2] 購物車（前端組 items）
[3] 試算            POST /api/v1.0/order/check      ──▶ iPOS check_voucher（有券才呼叫）
                     回傳 transaction_id（Redis 15 分鐘）
[4] 下單            POST /api/v1.0/order/booking
                     ├─ 存 SaleOrder（status=accept）
                     ├─ iPOS order_online（is_estimate=1）預檢 → 失敗就軟刪除訂單
                     └─ 依付款方式：
                         CASH       → 立刻 order_online（正式）
                         MOMO       → 建 MoMo 付款 → 等 IPN → order_online
                         WALLET     → 建 HEOVANG 交易 → 等 IPN → order_online
                         WALLET_COIN→ 扣 coin + HEOVANG → 等 IPN → order_online
[5] 狀態回寫        iPOS ──POST /api/v1/notify/callback──▶ 更新 SaleOrder.status
```

### 1.1 菜單同步
- 門市：`admin_api/sync_api.py:108` → iPOS `GET /ipos/ws/xpartner/pos`
- 商品：`cms_api/item.py:584 sync_item_foodbook_cms()`，cron 由 `manage.py backgroup_job_sync_item` 對每間門市各跑一次 → iPOS `GET /ipos/ws/xpartner/v2/items`
- APP 取菜單：`mobile_api/item_api.py:129`，讀本地 DB，篩 `active=True`、`is_child=None`、非 sub_item，依分類分組

### 1.2 購物車 item 結構（前端 `components/toppingModal/ToppingModal2.jsx:93`）
每一杯飲料會拆成多行，送出時共用同一個 `time_choose`：

| 行 | parent_id | price_list | is_send_pos |
|---|---|---|---|
| 主商品（有選 size 時） | 空 | 0 | false |
| size（childs） | 主商品 id | size 價格 | true |
| 加料（customizations options） | size id 或主商品 id | 加料價格 | true |
| 沒有 size 的主商品 | 空 | 商品價格 | true |

- `quantity` 是整杯的數量，每一行都套用同一個數字（`pages/confirmOrder/ConfirmOrder.jsx:122`）
- 送 iPOS 時會略過 `is_send_pos=false` 的行，並依 `time_choose` 排序（`mobile_api/order_api.py:919-923`）

### 1.3 試算 `POST /api/v1.0/order/check`（`mobile_api/order_api.py:209`）
Request：
```json
{
  "order_type": "PICK | DELI",
  "time_order_type": "schedule（預約）或其他值（立即）",
  "delivery_info": { "store_id": "本地 Store.id", "time_order": 1700000000, "contact_name": "", "contact_phone": "" },
  "vouchers": ["VOUCHER_CODE"],
  "coupon_code": "",
  "note": "",
  "items": [ { "id": "", "item_no": "", "item_name": "", "quantity": 1, "price_list": 0, "parent_id": "", "item_type": "", "time_choose": 0, "is_send_pos": true, "note": "" } ],
  "payment_methods": [ { "method_id": "", "method": "CASH|MOMO|WALLET|WALLET_COIN", "amount": 0, "name": "" } ]
}
```
邏輯：
1. 每行 `net_amount = round(quantity × price_list)`，`discount = 0`
2. 會員等級 `ContactRanking.point_item_percent`（預設 40）把金額拆成 point / coin
3. `schedule` + `DELI` → `DELIAT`
4. 外送才呼叫 `estimate_ship_fee`
5. 有券 → iPOS `check_voucher`，把 `Discount_Amount` 加進 discount
6. 用 coin 付款不能搭配優惠券
7. 回傳 `transaction_id`、`order_no`（8 碼大寫 md5）、各金額；hash 存 Redis 900 秒

### 1.4 下單 `POST /api/v1.0/order/booking`（`mobile_api/order_api.py:560`）
Request = check 的回傳內容，再加上 `transaction_id`、`order_no`、各金額欄位。
1. 檢查 Redis 裡的 transaction 是否過期（**hash 驗證已被註解掉，見 §4**）
2. 計算回饋 coin（`coin_refund`）、推薦點數，存 `SaleOrder`（`status=accept`）
3. `send_data_to_ipos(is_estimate=True)` 預檢；有錯誤就 `status=fail, deleted=True`
4. 依付款方式繼續（見上方流程圖）
5. MoMo：`build_data_momo()` 回傳 `momo_info`，前端用 `momo_info.applink` 開 APP

### 1.5 付款回呼
| 來源 | Route | 成功後 |
|---|---|---|
| MoMo IPN | `POST/GET /api/v1.0/payment_gateway/momo_qr/callback` | `resultCode==0` → `payment_status=success` → `send_data_to_ipos` |
| HEOVANG IPN | `POST /api/v1.0/business-order/update-payment-status`（body：`saleorder_no`） | `send_data_to_ipos`；失敗就退點、退 coin |

### 1.6 iPOS 狀態回呼 `POST /api/v1/notify/callback`（`mobile_api/notify.py:712`）
`event = notify_order_online`，body 內是 `notify_order_online.{foodbook_code, status, note_of_cancelled}`：

| iPOS status | 本地 status |
|---|---|
| WAIT_CONFIRM | wait_confirm |
| ACCEPTED | accept |
| CONFIRMED | confirm |
| COMPLETED | completed |
| CANCELLED | cancel |
| ASSIGNING | wait_delivery |
| IN PROCESS | delivery |

`event = sale_manager`：POS 結帳事件。如果是 APP 外送單就標成 completed，否則當成門市現場單另存（`build_data_save_order_in_app_event_sale_manager`）。

---

## 2. iPOS API 規格（從程式碼反推）

認證方式都一樣：query string 帶 `access_token=FOODBOOK_ACCESS_TOKEN`，品牌用 `pos_parent=FOODBOOK_POS_PARENT`，門市用 `pos_id`（int，等於本地 `Store.store_no`）。

### 2.1 Base `FOODBOOK_URL` + `/ipos/ws/xpartner/...`

| Endpoint | Method | 參數 | 用途 | 出處 |
|---|---|---|---|---|
| `pos` | GET | access_token, pos_parent | 門市清單 | `admin_api/sync_api.py:115` |
| `v2/items` | GET | access_token, pos_parent, pos_id, menu_type=ALL | 菜單、出餐時段 | `cms_api/item.py:605`、`mobile_api/store.py:83` |
| `membership_detail` | GET | user_id=電話（去掉 `+`） | 查會員 | `mobile_api/user_api.py:234` |
| `add_membership` / `update_membership` | — | — | 新增、更新會員 | `ver2/user_api.py:368,391` |
| `get_membership_types` | GET | access_token, pos_parent | 會員等級 | `admin_api/sync_api.py:149` |
| `member_vouchers` | GET | user_id=84xxxxxxxxx, page, number_per_page | 會員優惠券 | `mobile_api/voucher.py:33` |
| `membership_log` / `gen_vouchers` / `exchange_point` / `user/point_exchange` / `checkin_code` / `send_sms` / `callback/loyalty` | — | — | 點數、券、簡訊 | `mobile_api/voucher.py`、`user_api.py`、`sms_api.py` |

**`pos` 回傳欄位**（`admin_api/sync_api.py:83`）：`Id`、`Pos_Name`、`Pos_Address`、`Pos_Latitude`、`Pos_Longitude`、`Open_Time`、`Phone_Number`、`Wifi_Password`、`City_Id`、`City_Name`、`District_Id`、`Active`(1/0)、`Image_Path`、`Delivery_Services`

**`v2/items` 回傳**（`cms_api/item.py:584-760`）：
```
data.items[]:
  store_item_id → item_no      type_id → 分類 (item_type)
  name, description, ta_price → 價格, status (ACTIVE/DEACTIVE), sort, image_url, store_id
  childs[]           → size（每個都有自己的 ta_price、customizations）
  customizations[]   → { name, min_permitted, max_permitted,
                         options[]: { id, item_type_id, name, ta_price, status, sort, image_url } }
data.time_delivery[] → 出餐 / 外送時段
data.list_special_combo[] → 套餐（目前程式沒使用）
```

### 2.2 Base `FOODBOOK_URL_PARTNER`

#### `POST /order_online?access_token=`（`mobile_api/order_api.py:894-1063`）
```json
{
  "foodbook_code": "ORDER_NO（大寫）",
  "pos_id": 123,
  "pos_parent": "BRAND",
  "order_data_item": [
    { "Item_Type_Id": "", "Item_Id": "item_no", "Item_Name": "", "Price": 0, "Quantity": 1,
      "Note": "", "Discount": 0, "Foc": 0, "Fix": 0 }
  ],
  "adapt_to_online": 1,
  "note": "",
  "coupon_log_id": "VOUCHER_CODE 或 null",
  "order_type": "PICK | DELI | DELIAT",
  "user_id": "84xxxxxxxxx（電話）",
  "username": "姓名",
  "return_data": "full",
  "is_estimate": 0,
  "is_pending": 0,
  "amount": 0,
  "total_amount": 0,
  "PaymentInfo": { "Payment_Method": "COD|MOMO|FTCOIN|HEOVANGQR4", "Payment_Info": "ORDER_NO", "Amount": 0 },
  "booking_info": { "Book_Date": "YYYY-MM-DD HH:MM:SS", "Hour": "14", "Minute": "30", "Number_People": -1, "Note": "" }
}
```
- `is_estimate=1` 只檢查不下單
- `booking_info` 只有 PICK / DELIAT 會帶；時間早於現在時改成現在 +1 分鐘
- 外送會多帶 `ship_price_real`、`distance`、`longitude`、`latitude`、`to_address`
- 付款方式對照：CASH / CODDELIVERY → `COD`（Amount=0）、WALLET_COIN → `FTCOIN`、WALLET → `HEOVANGQR4`、MOMO 照原值送出
- 用 coin 付款時，`Discount` 填比例 `coin / net_amount`（取到小數 4 位）
- 判斷結果：回應 JSON 沒有 `error` 欄位就是成功；有的話讀 `error.code`

| iPOS 錯誤碼 | 意思 |
|---|---|
| 301 | 送單太頻繁 |
| 1502 | 門市未營業 |
| 1902 | 商品缺貨 |

#### `POST check_voucher?access_token=`（`mobile_api/order_api.py:429-459`）
```json
{ "pos_id": 123, "pos_parent": "BRAND", "voucher_code": "", "membership_id": "電話（去掉第一個字元）", "order_data_item": [ ...同上 ] }
```
回傳 `data.Discount_Amount`、`data.voucher_campaign_name`、`data.Discount_Description`。
（程式是直接接字串 `"check_voucher"`，前面沒有 `/`，和 `/order_online` 寫法不一樣，要看 `FOODBOOK_URL_PARTNER` 的實際值才能確定完整網址。）

#### `GET /estimate_ship_fee`
外送運費，Kiosk 用不到。

### 2.3 MoMo（`mobile_api/payment_controller.py:32`）
- `POST {MOMO_URL}/v2/gateway/api/create`，`requestType=captureWallet`
- 簽章：HMAC-SHA256(SECRET_KEY)，原文是 `accessKey&amount&extraData&ipnUrl&orderId&orderInfo&partnerCode&redirectUrl&requestId&requestType`
- `orderId` = 訂單號，同時記一筆 `PaymentTransaction(status=pending)`

---

## 3. 對 Kiosk 的意義

| 舊流程 | Kiosk 作法 |
|---|---|
| 會員一定要登入（`current_uid`） | 會員改成選填；不登入就不帶 `user_id`，或帶門市預設值（需和 iPOS 確認是否允許空值） |
| `order_type` 有 PICK / DELI / DELIAT | 只用 PICK（自取）；iPOS 有沒有內用類型要問 iPOS |
| 外送、運費、地址 | 拿掉 |
| 現金 → COD Amount=0 | 「櫃台付款」可以沿用 |
| MoMo 開 APP（applink） | Kiosk 要改成顯示 QR，MoMo 回傳的 QR 欄位要另外確認 |
| 菜單只有單一語言 | iPOS 只有一種 `name`，多語系要自己建一張翻譯表（item_no × lang） |
| 會員價 | 舊程式沒有在本地算會員價：只有 point/coin 拆帳和 iPOS 優惠券。若要會員折扣，要確認 iPOS 是否有對應的 price list |

可以直接沿用的 iPOS API：`pos`、`v2/items`、`order_online`（先 estimate 再正式送）、`check_voucher`、`membership_detail`、`notify/callback`。

## 4. 舊程式的問題（不要照抄）
1. `order/booking` 的 hash 驗證被註解掉（`order_api.py:584-598`），金額直接採用前端傳來的值，可能被竄改
2. MoMo callback 用 `int(amount) == int(amount)`（`payment_controller.py:116`），永遠成立，等於沒驗金額，也沒驗 MoMo 簽章
3. 訂單先 commit 才送 iPOS 預檢，失敗後只能軟刪除
4. iPOS 回傳 100 時的 MoMo 退款只寫了 `pass`（`payment_controller.py:130`）
5. Token 放在 query string 並寫進 log

---

## 5. 自助點單機（本專案實作）

- 頁面：`/pos/kiosk/ft?key=<device_key>`（`src/app/(kiosk)/pos/kiosk/ft/page.tsx`），key 會存在 localStorage
- 伺服器端轉接：`/api/pos/ft/menu`、`/api/pos/ft/member`、`/api/pos/ft/order`（`src/lib/ft-kiosk/server.ts`）
  - 一律經過會員 APP 後端，不直接呼叫 iPOS
  - 前端只送「選了哪些品項 id」，價格與 min/max 由伺服器依菜單重算
- 流程：選語言 → 內用/外帶 → 菜單 → 購物車 → 輸入會員電話（可略過，`check_user` 確認）→ 櫃台付款 → 取餐號碼
- 付款：只有櫃台付款，送 `CASH`（iPOS 收到 `COD`），客人到櫃台用現金或 FABI 上的 VNPAY 付款
- 內用/外帶寫在訂單備註（`Kiosk - Ăn tại chỗ` / `Kiosk - Mang đi`），`order_type` 固定 `PICK`
- 閒置 120 秒自動回首頁，完成頁 30 秒後回首頁並切回越南文

### 環境變數

| 變數 | 說明 |
|---|---|
| `FT_API_BASE_URL` | 會員 APP 後端網址。**未設定 = 展示模式**（假菜單、不送單，任何 key 都可用）。舊程式碼中正式機為 `https://feelingtea.gonapp.net`、測試機 `https://feelingteadev.gonapp.net`（`feelingtea-mobile-app/src/constants/env.js`） |
| `FT_KIOSK_LOGIN_PHONE` / `FT_KIOSK_LOGIN_PASSWORD` | 門市帳號（需在會員 APP 設好密碼）。伺服器自動呼叫 `/app/api/v2/login` 取得 token，過期（`PERMISSION_ERROR`）時自動重新登入 |
| `FT_KIOSK_DEVICES` | JSON，每台點單機一筆：`{"<device_key>":{"storeNo":"<iPOS pos_id>"}}`。Store.id 與門市名稱會用 storeNo 自動查；可選 `storeName`（覆蓋顯示名稱）、`loginPhone`/`loginPassword`（該門市用不同帳號） |
| `FT_KIOSK_MENU_STORE_NO` | 選填。本門市在會員 APP 沒有菜單（新門市還沒同步）時，改用這間門市的菜單顯示，訂單仍送到本門市。單台可在 `FT_KIOSK_DEVICES` 用 `menuStoreNo` 覆蓋 |

storeNo 查法：瀏覽器打開 `<FT_API_BASE_URL>/app/api/v1/store`，每間門市的 `store_no` 就是 storeNo。

### 菜單翻譯
- Supabase 表 `ft_menu_translations`：以 iPOS 越南文原文為 key，存 `zh_tw`、`en`
- 載入菜單時，沒有翻譯的字串會在回應後背景用 Claude 翻譯並寫入，下次載入就有中英文
- 要人工修正：直接改該列的 `zh_tw` / `en`，並把 `manual` 設為 true

### 上線前待確認
1. 會員 APP 後端正式網址（打開 `/app/api/v1/store` 能看到門市 JSON 就是對的）
2. 建一個門市帳號並設定密碼
3. 實測：`contact_phone` 留空能否送單、帶會員電話時 iPOS 是否累積點數

### 列印模式（客人拿單到櫃台結帳）
- 在 `FT_KIOSK_DEVICES` 該台加 `"mode":"print"`，例如 `{"giangvo-p1-xxxx":{"storeNo":"166975","mode":"print"}}`
- 菜單一樣讀會員 APP（含翻譯），但**不送 iPOS、不需門市帳號**
- 下單後存一筆 `ft_print_orders`（每間門市每天從 001 開始編號），點單機透過本機 `pos-bridge` 的 `/print/ticket` 同時印：
  - 客人聯：點單機旁的印表機（`KIOSK_PRINTER`），寫「請至櫃台結帳」
  - 吧檯聯：吧檯印表機（`BAR_PRINTER`），寫「CHƯA THANH TOÁN」
- 單據品名用 iPOS 越南文原文，店員才能在 FABI 找到同一品項結帳
- 印表機設定見 `pos-bridge/DEPLOY.md`；bridge 沒開時畫面仍會顯示號碼並提示列印失敗
- 展示模式下，key 含 `print` 就是列印模式（例如 `?key=demo-print`）
