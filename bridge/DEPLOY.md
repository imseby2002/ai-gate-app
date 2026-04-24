# Oracle Cloud 部署指南

## 1. 建立 Oracle Cloud VM
- 選 Always Free: VM.Standard.A1.Flex (ARM, Ubuntu 22.04)
- 4 OCPUs / 24GB RAM (免費)
- 開放 Inbound: TCP port 3001 (Security List)

## 2. 連線到 VM 後安裝環境
```bash
# 安裝 Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# 安裝 PM2
sudo npm install -g pm2

# 安裝 Chromium dependencies (Baileys 需要)
sudo apt-get install -y libgbm-dev libnss3 libatk1.0-0 libatk-bridge2.0-0 libcups2 libdrm2 libxkbcommon-x11-0 libxcomposite-dev libxdamage1 libxrandr2 libgbm1 libpango-1.0-0 libpangocairo-1.0-0

# 安裝 Git
sudo apt-get install -y git
```

## 3. 部署 Bridge
```bash
# 複製 bridge 目錄到伺服器 (或 git clone 整個 repo)
cd ~
mkdir aigate-bridge
# 把 bridge/ 目錄的內容上傳到這裡

cd aigate-bridge
npm install
```

## 4. 設定環境變數
```bash
# 建立 .env 檔案 (PM2 會讀取)
cat > .env << 'EOF'
PORT=3001
API_KEY=your-super-secret-key-change-this
AIGATE_URL=https://your-app.vercel.app
EOF
```

或直接 export：
```bash
export API_KEY="your-super-secret-key"
export AIGATE_URL="https://your-app.vercel.app"
```

## 5. 啟動 (PM2)
```bash
pm2 start ecosystem.config.cjs --env production
pm2 save
pm2 startup  # 設定開機自動啟動
```

## 6. 防火牆開放 port 3001
```bash
sudo iptables -I INPUT -p tcp --dport 3001 -j ACCEPT
sudo netfilter-persistent save
```

## 7. 在 Vercel 設定環境變數
```
WHATSAPP_BRIDGE_URL = http://YOUR_ORACLE_IP:3001
WHATSAPP_BRIDGE_API_KEY = your-super-secret-key (同上)
```

## 8. 驗證
```bash
curl http://YOUR_ORACLE_IP:3001/health
# → {"ok":true,"sessions":0}
```

## 9. 測試 API (從 AI GATE server)
```bash
# 啟動 session
curl -X POST http://YOUR_ORACLE_IP:3001/start \
  -H "x-api-key: your-secret" \
  -H "Content-Type: application/json" \
  -d '{"userId":"test-user"}'

# 取得 QR code
curl "http://YOUR_ORACLE_IP:3001/qr?userId=test-user" \
  -H "x-api-key: your-secret"
```
