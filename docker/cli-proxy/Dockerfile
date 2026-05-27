# 用於 Fly.io 部署：在官方 image 上烤入 config.yaml
# 部署前先：cp config.example.yaml config.yaml 並填入金鑰。
# config.yaml 已被 git 忽略（不會外洩），但會打進你 Fly 帳號的私有 image。
FROM eceasy/cli-proxy-api:latest
COPY config.yaml /CLIProxyAPI/config.yaml
