#!/usr/bin/env bash
# 打包 Chrome Web Store 上傳用的 zip（zip 根目錄即 manifest.json）
set -euo pipefail
cd "$(dirname "$0")"
OUT=dist/aigate-connector-store.zip
mkdir -p dist
rm -f "$OUT"
# 進到 booking/ 內部打包，讓 manifest.json 位於 zip 根層；排除開發用檔案
( cd booking && zip -rq "../$OUT" . -x 'node_modules/*' -x '*.DS_Store' -x 'STORE_LISTING.md' -x 'README.md' )
echo "built $OUT"
