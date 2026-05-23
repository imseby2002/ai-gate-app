# OTA Scraper Microservice

curl_cffi (TLS fingerprint) + Camoufox (stealth browser) + rotating residential proxies.

## 架構

```
Agoda URL → curl_cffi (Chrome TLS) + rotating proxies → 成功
                ↓ 失敗
           Camoufox stealth browser → 成功
                ↓ 失敗
           回傳 422（前端提示改貼文字）
```

## 環境變數

| 變數 | 說明 |
|---|---|
| `SCRAPER_API_KEY` | 服務鑑權 key（Next.js 端對應 `OTA_SCRAPER_KEY`） |
| `PROXY_URL` | 單一 rotating proxy 閘道（e.g. `http://user:pass@host:8080`） |
| `PROXY_LIST` | 多個 proxy，逗號分隔 |

## 部署到 Fly.io（推薦）

```bash
cd scraper
fly auth login
fly launch          # 第一次，會建立 app
fly secrets set SCRAPER_API_KEY=your-secret
fly secrets set PROXY_URL=http://user:pass@proxy-host:8080
fly deploy
```

部署完成後取得 URL（如 `https://ota-scraper.fly.dev`），設定到 Vercel：
```
OTA_SCRAPER_URL = https://ota-scraper.fly.dev
OTA_SCRAPER_KEY = your-secret
```

## 本地測試

```bash
pip install -r requirements.txt
python -m camoufox fetch          # 下載 browser binary（首次）
uvicorn main:app --port 8000

# 測試
curl -X POST http://localhost:8000/scrape \
  -H "Content-Type: application/json" \
  -d '{"url": "https://www.agoda.com/..."}'
```

## Proxy 說明

- **無 proxy**：直接從 Fly.io IP 發出，Agoda 可能封鎖
- **單一 rotating gateway**（推薦）：用 Brightdata / Oxylabs / Smartproxy 等，設 `PROXY_URL`
- **自架 proxy 池**：設 `PROXY_LIST`，服務自動輪換
