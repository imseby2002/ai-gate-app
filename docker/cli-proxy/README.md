# CLIProxy 自架（從 Fly.io 搬到自己的主機）

CLIProxy 沒有需要 build 的原始碼，它就是官方 image [`eceasy/cli-proxy-api`](https://hub.docker.com/r/eceasy/cli-proxy-api)（原始碼：[router-for-me/CLIProxyAPI](https://github.com/router-for-me/CLIProxyAPI)）。
搬遷要帶走的只有兩樣屬於你的東西：

| 項目 | Fly 上的位置 | 用途 |
| --- | --- | --- |
| `config.yaml` | `/CLIProxyAPI/config.yaml`（被 `Dockerfile` 烤進 image） | API 金鑰、管理密鑰、模型別名 |
| OAuth 授權檔 | `/root/.cli-proxy-api/`（volume `cliproxy_data`） | Kiro / Copilot / Gemini 等免費通道的 token |

## 一、從 Fly 匯出

macOS / Linux：

```bash
./scripts/cli-proxy-export-from-fly.sh imseby-cli-proxy
```

Windows PowerShell（沒有 `base64`，且 `>` 會破壞二進位檔，所以用 flyctl 的 sftp）：

```powershell
fly ssh console -a imseby-cli-proxy -C "tar czf /tmp/auths.tgz -C /root/.cli-proxy-api ."
fly ssh sftp get /tmp/auths.tgz -a imseby-cli-proxy
fly ssh sftp get /CLIProxyAPI/config.yaml -a imseby-cli-proxy
```

`fly ssh console` 會自動喚醒已停機的 machine，不必先手動開。

若 `auths.tgz` 只有幾十 bytes，代表 volume 裡沒有 token，改成在新主機重新 OAuth 登入（見下方「重新登入」）。

## 二、在主機上還原

```bash
./scripts/cli-proxy-install-on-host.sh ~/cli-proxy-migration.tgz ~/cli-proxy
```

手動做也可以：

```bash
mkdir -p ~/cli-proxy/auths ~/cli-proxy/logs && cd ~/cli-proxy
tar xzf auths.tgz -C auths
cp /path/to/config.yaml . && chmod 600 config.yaml
cp <repo>/docker/cli-proxy/docker-compose.yml .
docker compose up -d
```

驗證：

```bash
curl http://localhost:8317/v1/models -H "Authorization: Bearer <config.yaml 裡的 api-keys>"
```

## 三、對外

AI GATE 跑在 Vercel，必須從公網打得到這台。

**有固定 IP + 自己的 domain** → Caddy 反向代理，自動簽 HTTPS：

```
proxy.example.com {
    reverse_proxy localhost:8317
}
```

**家用寬頻、沒有固定 IP** → Cloudflare Tunnel，不用開任何對外埠：

```bash
cloudflared tunnel create cli-proxy
cloudflared tunnel route dns cli-proxy proxy.example.com
cloudflared tunnel run --url http://localhost:8317 cli-proxy
```

不論哪種，**只暴露 8317**。8085 / 1455 / 54545 / 51121 是 OAuth callback 埠，只在重新登入時需要，平常不要對外。

## 四、切換 AI GATE

Vercel 環境變數 `CLI_PROXY_API_URL` 改成新網址後 redeploy，再到 `/admin/usage` 按「連線測試」確認。
`CLI_PROXY_API_KEY` 要跟 `config.yaml` 的 `api-keys` 一致。

跑穩幾天再 `fly apps destroy imseby-cli-proxy`。

## 重新登入（沒搬到 token 時）

`docker-compose.yml` 已經把 callback 埠都開好了。開 `http://<主機>:8317/management.html`，用 `config.yaml` 的 `secret-key` 登入，逐一點各家 OAuth。
過程中瀏覽器會被導回 `localhost:<callback 埠>`，所以要在**能直接連到這台主機的瀏覽器**上操作（同一台機器、或內網 + SSH port forward）。

## 注意

- `config.yaml` 和 `auths/` 都含機密，已由 `.gitignore` 排除，不要 commit。
- 容器設 `restart: unless-stopped`，開機自動起，沒有 Fly 那種閒置停機與冷啟動問題。
