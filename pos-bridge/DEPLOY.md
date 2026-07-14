# Debian 門市點單 Bridge

## 安裝

```bash
sudo apt install -y nodejs npm chromium cups bluez
cd pos-bridge && npm install
```

## 環境變數 `.env`

```
PORT=3002
DEVICE_KEY=<門市終端 device_key>
AIGATE_URL=https://work.im-tourist.com
```

## 啟動

```bash
pm2 start index.js --name pos-bridge
pm2 save && pm2 startup
```

## Kiosk 全螢幕

```bash
chromium --kiosk --app="https://work.im-tourist.com/pos/kiosk?key=DEVICE_KEY"
```

## 硬體

| 設備 | 說明 |
|---|---|
| USB 掃碼器 | HID 鍵盤模式，Kiosk 內按「掃碼」聚焦即可 |
| USB 印表機 | 確認 ESC/POS 型號後，於 `index.js` 的 `printReceipt` 接入驅動 |
| 藍牙印表機 | 建議先 `lpadmin` 綁 CUPS，再由 bridge 送 `lp` 指令 |

## API

- `GET /health`
- `POST /print/receipt` — Kiosk 下單後自動呼叫
- `POST /print/kitchen` — 廚房單
- `POST /sync/pull` — 拉菜單
- `POST /sync/push` — 推離線訂單
