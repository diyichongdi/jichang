#!/usr/bin/env bash
# ============================================================
#  Xboard-Node 节点后端一键部署脚本 (Debian/Ubuntu)
#  Xboard 官方配套后端，支持 Reality / Hysteria2 等新协议
#  在每台 节点VPS 上以 root 运行：
#     bash setup-node.sh
# ============================================================
set -euo pipefail

# ---------- 配置区(自行修改) ----------
NODE_DIR="/opt/xboard-node"
NODE_DOMAIN="node.example.com"    # 节点证书域名(需解析到本机)；用端口直连可留空
CF_API_TOKEN=""                   # 用 Cloudflare DNS-01 时填，否则留空自动用 HTTP-01
AUTO_TLS="true"
KERNEL_TYPE="sing_box"            # sing_box 或 xray

echo "======================================================"
echo "  Xboard-Node 节点后端部署"
echo "======================================================"

if [ "$(id -u)" -ne 0 ]; then
  echo "错误：请用 root 运行" >&2; exit 1
fi

# ---------- 1. 安装 Docker ----------
if ! command -v docker >/dev/null 2>&1; then
  echo ">> 安装 Docker..."
  curl -fsSL https://get.docker.com -o /tmp/get-docker.sh
  sh /tmp/get-docker.sh
fi

# ---------- 2. 写 compose ----------
mkdir -p "$NODE_DIR/certs"
cat > "$NODE_DIR/docker-compose.yml" <<'YAML'
version: '3.8'
services:
  xboard-node:
    image: ghcr.io/cedar2025/xboard-node:latest
    container_name: xboard-node
    restart: unless-stopped
    network_mode: host
    volumes:
      - ./config.yml:/etc/xboard-node/config.yml
      - ./certs:/etc/xboard-node/certs
YAML

# ---------- 3. 写 config.yml ----------
cat > "$NODE_DIR/config.yml" <<YML
panel:
  panel_type: "new_v2board"
  api_host: "https://xboard.example.com"   # 改成你的面板域名
  api_key: "请在面板后台填通讯密钥"
  node_id: 1                               # 面板后台节点 ID
  timeout: 30
  enable_log: true

kernel:
  type: "$KERNEL_TYPE"
  config_dir: "/etc/xboard-node/"

cert:
  auto_tls: $AUTO_TLS
  domain: "$NODE_DOMAIN"
  dns_provider: "cloudflare"
  dns_cloudflare_api_token: "$CF_API_TOKEN"
  email: "you@example.com"

runtime:
  gomemlimit: ""
YML

echo ">> 已生成 $NODE_DIR/config.yml，请打开修改：面板域名/通讯密钥/节点ID"
echo ">> 现在用 nano 打开编辑...(3 秒后自动打开，Ctrl+X 保存)"
sleep 3
nano "$NODE_DIR/config.yml" || true

# ---------- 4. 启动 ----------
cd "$NODE_DIR"
docker compose pull
docker compose up -d

echo "======================================================"
echo "  完成！查看日志： docker logs -f xboard-node"
echo "  状态检查：   docker ps | grep xboard-node"
echo "======================================================"
