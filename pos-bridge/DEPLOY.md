# Debian 門市點單 Bridge

## 安裝

```bash
sudo apt install -y nodejs npm chromium cups bluez fonts-noto-core fonts-noto-cjk
cd pos-bridge && npm install
```

## 環境變數 `.env`

```
PORT=3002
DEVICE_KEY=<門市終端 device_key>
AIGATE_URL=https://work.im-tourist.com
KIOSK_PRINTER=kiosk   # 點單機旁的印表機（印客人聯）
BAR_PRINTER=bar       # 吧檯印表機（印吧檯聯）
CHROMIUM_BIN=chromium
PAPER_WIDTH_MM=80     # 58mm 紙卷改成 58
```

沒設定 `KIOSK_PRINTER` / `BAR_PRINTER` 時，單據只印在 bridge 的 log，不會報錯。

## 印表機（CUPS）

兩台都加進 CUPS，名稱要和 `.env` 一致：

```bash
# 點單機 USB 印表機：先找裝置網址
lpinfo -v
sudo lpadmin -p kiosk -E -v 'usb://<lpinfo 列出的網址>' -m <驅動>

# 吧檯網路印表機（ESC/POS 熱感應機通常是 9100 埠）
sudo lpadmin -p bar -E -v socket://192.168.1.50:9100 -m <驅動>

# 測試
lp -d kiosk /usr/share/cups/data/testprint
```

`<驅動>` 依印表機型號，熱感應機通常由廠商提供 CUPS 驅動（例如 Epson TM、Xprinter）。單據先用 Chromium 轉成 PDF 再送 CUPS，越南文和中文才不會變亂碼。

## 啟動

```bash
pm2 start index.js --name pos-bridge
pm2 save && pm2 startup
```

## Kiosk 全螢幕

```bash
chromium --kiosk --app="https://work.im-tourist.com/pos/kiosk?key=DEVICE_KEY"

# Feeling Tea 點單機（列印模式，device_key 在 FT_KIOSK_DEVICES 設 "mode":"print"）
chromium --kiosk --app="https://work.im-tourist.com/pos/kiosk/ft?key=<device_key>"
```

## 硬體

| 設備 | 說明 |
|---|---|
| USB 掃碼器 | HID 鍵盤模式，Kiosk 內按「掃碼」聚焦即可 |
| USB 印表機 | 確認 ESC/POS 型號後，於 `index.js` 的 `printReceipt` 接入驅動 |
| 藍牙印表機 | 建議先 `lpadmin` 綁 CUPS，再由 bridge 送 `lp` 指令 |

## API

- `GET /health`
- `POST /print/ticket` — Feeling Tea 點單機列印模式：同時印客人聯（KIOSK_PRINTER）和吧檯聯（BAR_PRINTER）
- `POST /print/receipt` — Kiosk 下單後自動呼叫
- `POST /print/kitchen` — 廚房單
- `POST /sync/pull` — 拉菜單
- `POST /sync/push` — 推離線訂單
