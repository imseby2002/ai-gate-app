#!/usr/bin/env bash
# 從 Fly.io 匯出 CLIProxy 的 config.yaml 與 OAuth 授權檔，打包成一個 tgz。
#
# 在「有安裝 flyctl 且已 fly auth login」的電腦上執行（不是 Debian 主機也沒關係，
# 產出的 bundle 再傳過去即可）。
#
#   ./scripts/cli-proxy-export-from-fly.sh [fly-app-name] [輸出檔]
#
# 預設 app = imseby-cli-proxy，輸出 = ./cli-proxy-migration.tgz
set -euo pipefail

APP="${1:-imseby-cli-proxy}"
OUT="${2:-$PWD/cli-proxy-migration.tgz}"

command -v fly >/dev/null 2>&1 || { echo "找不到 flyctl，請先安裝：https://fly.io/docs/flyctl/install/" >&2; exit 1; }

WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT
mkdir -p "$WORK/bundle/auths"

echo "==> 喚醒機器並在機器內打包授權檔（$APP）"
# fly ssh console 會自動 start 已停機的 machine，所以不必先手動開。
fly ssh console -a "$APP" -C "tar czf /tmp/cliproxy-auths.tgz -C /root/.cli-proxy-api ."

echo "==> 下載授權檔"
( cd "$WORK" && fly ssh sftp get /tmp/cliproxy-auths.tgz -a "$APP" )
tar xzf "$WORK/cliproxy-auths.tgz" -C "$WORK/bundle/auths"

echo "==> 下載 config.yaml"
# 這個路徑來自 docker/cli-proxy/Dockerfile：config.yaml 被烤進 image 的 /CLIProxyAPI/config.yaml
( cd "$WORK" && fly ssh sftp get /CLIProxyAPI/config.yaml -a "$APP" )
mv "$WORK/config.yaml" "$WORK/bundle/config.yaml"

echo "==> 清掉機器上的暫存檔"
fly ssh console -a "$APP" -C "rm -f /tmp/cliproxy-auths.tgz" || true

tar czf "$OUT" -C "$WORK/bundle" .

echo
echo "完成：$OUT"
echo "內含 config.yaml（有金鑰）與 auths/（OAuth token），請用安全方式傳到主機，不要進 git。"
echo
echo "授權檔清單："
find "$WORK/bundle/auths" -type f -printf '  %P\n' 2>/dev/null || ls -1 "$WORK/bundle/auths"
