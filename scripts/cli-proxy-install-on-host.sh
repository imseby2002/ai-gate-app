#!/usr/bin/env bash
# 在自己的主機（Debian）上還原 CLIProxy：解開 bundle、擺好目錄、用 docker compose 起服務。
#
#   ./scripts/cli-proxy-install-on-host.sh <bundle.tgz> [安裝目錄]
#
# 預設安裝目錄 = ~/cli-proxy
set -euo pipefail

BUNDLE="${1:-}"
DEST="${2:-$HOME/cli-proxy}"
REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

[ -n "$BUNDLE" ] || { echo "用法：$0 <cli-proxy-migration.tgz> [安裝目錄]" >&2; exit 1; }
[ -f "$BUNDLE" ] || { echo "找不到 bundle：$BUNDLE" >&2; exit 1; }
command -v docker >/dev/null 2>&1 || { echo "找不到 docker" >&2; exit 1; }
docker compose version >/dev/null 2>&1 || { echo "找不到 docker compose plugin（apt install docker-compose-plugin）" >&2; exit 1; }

mkdir -p "$DEST/auths" "$DEST/logs"

if [ -e "$DEST/config.yaml" ]; then
  cp -a "$DEST/config.yaml" "$DEST/config.yaml.bak.$(date +%Y%m%d%H%M%S)"
  echo "==> 既有 config.yaml 已備份"
fi

echo "==> 解開 bundle 到 $DEST"
tar xzf "$BUNDLE" -C "$DEST"

echo "==> 複製 docker-compose.yml"
cp "$REPO_DIR/docker/cli-proxy/docker-compose.yml" "$DEST/docker-compose.yml"

chmod 600 "$DEST/config.yaml"
chmod -R go-rwx "$DEST/auths"

echo "==> 啟動容器"
cd "$DEST"
docker compose up -d

echo "==> 等待服務就緒"
ready=no
for _ in $(seq 1 30); do
  # 沒帶 API key 會得到 401，但只要有 HTTP 回應就代表容器已經在聽了。
  code="$(curl -s -o /dev/null -w '%{http_code}' "http://localhost:8317/v1/models" || true)"
  if [ "$code" != "000" ] && [ -n "$code" ]; then
    echo "服務已就緒（HTTP $code）。"
    ready=yes
    break
  fi
  sleep 2
done
[ "$ready" = yes ] || echo "（30 秒內沒有回應，用 docker compose logs -f 看原因）"

cat <<TIP

安裝目錄：$DEST
  config.yaml  金鑰設定（已 chmod 600）
  auths/       OAuth 授權檔
  logs/        執行記錄

下一步：
  1. docker compose logs -f          # 確認沒有錯誤
  2. 設定對外反向代理（見 docker/cli-proxy/README.md）
  3. 改 Vercel 的 CLI_PROXY_API_URL 指向新網址並 redeploy
  4. 跑穩幾天後才 fly apps destroy imseby-cli-proxy
TIP
