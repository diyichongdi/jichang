#!/usr/bin/env bash
# ============================================================
#  Xboard 面板一键部署脚本 (Debian/Ubuntu)
#  在 面板VPS 上以 root 运行：
#     bash setup-panel.sh
#  作用：装 Docker -> 生成 compose/.env -> 反代 -> 初始化
# ============================================================
set -euo pipefail

# ---------- 配置区(自行修改) ----------
DOMAIN="xboard.example.com"          # 你的面板域名
DB_PASSWORD="$(openssl rand -base64 18 | tr -d '/+=')"  # 随机强密码
PANEL_DIR="/opt/xboard"
USE_CADDY="yes"                      # yes=用Caddy反代(推荐) no=仅面板(手动配Nginx)

echo "======================================================"
echo "  Xboard 面板部署"
echo "------------------------------------------------------"
echo "  域名: $DOMAIN"
echo "  目录: $PANEL_DIR"
echo "======================================================"

# ---------- 0. 检查 root ----------
if [ "$(id -u)" -ne 0 ]; then
  echo "错误：请用 root 运行" >&2; exit 1
fi

# ---------- 1. 安装 Docker ----------
if ! command -v docker >/dev/null 2>&1; then
  echo ">> 安装 Docker..."
  curl -fsSL https://get.docker.com -o /tmp/get-docker.sh
  sh /tmp/get-docker.sh
fi
# ---------- 2. 安装依赖 ----------
if ! command -v openssl >/dev/null 2>&1; then
  apt-get update && apt-get install -y openssl nano curl
fi

# ---------- 3. 写入 compose 与 .env ----------
mkdir -p "$PANEL_DIR"
cat > "$PANEL_DIR/docker-compose.yml" <<'YAML'
version: '3.8'
services:
  xboard:
    image: ghcr.io/cedar2025/xboard:latest
    container_name: xboard
    restart: unless-stopped
    environment:
      - docker=true
    ports:
      - "127.0.0.1:7001:7001"
    volumes:
      - ./.env:/www/.env
    depends_on:
      - mariadb
      - redis
  mariadb:
    image: mariadb:10.11
    container_name: xboard-mariadb
    restart: unless-stopped
    environment:
      MARIADB_ROOT_PASSWORD: "${DB_PASSWORD}"
      MARIADB_DATABASE: xboard
    volumes:
      - ./mariadb-data:/var/lib/mysql
  redis:
    image: redis:7.0-alpine
    container_name: xboard-redis
    restart: unless-stopped
    volumes:
      - ./redis-data:/data
YAML

cat > "$PANEL_DIR/.env" <<ENV
DB_PASSWORD="$DB_PASSWORD"
ENV

# ---------- 4. 初始化安装 ----------
cd "$PANEL_DIR"
echo ">> 拉取镜像并初始化 Xboard (按向导填写: 数据库地址=mariadb, Redis=redis)..."
docker compose pull
docker compose run -it --rm xboard php artisan xboard:install

# ---------- 5. Caddy 反代 (可选) ----------
if [ "$USE_CADDY" = "yes" ]; then
  echo ">> 配置 Caddy 反代..."
  mkdir -p "$PANEL_DIR/caddy"
  cat > "$PANEL_DIR/caddy/Caddyfile" <<CADDY
$DOMAIN {
    reverse_proxy 127.0.0.1:7001
    encode gzip
    request_body {
        max_size 0
    }
}
CADDY

  cat > "$PANEL_DIR/caddy/docker-compose.yml" <<'YAML'
version: '3.8'
services:
  caddy:
    image: caddy:2
    container_name: xboard-caddy
    restart: unless-stopped
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./Caddyfile:/etc/caddy/Caddyfile
      - ./caddy_data:/data
      - ./caddy_config:/config
YAML
  cd "$PANEL_DIR/caddy"
  docker compose up -d
  echo ">> Caddy 已启动，请把域名 $DOMAIN A 记录解析到本机 IP，等待证书自动签发"
fi

# ---------- 6. 启动面板 ----------
cd "$PANEL_DIR"
docker compose up -d

echo "======================================================"
echo "  部署完成！后续步骤："
echo "  1) 把域名 $DOMAIN 解析到本机 IP"
echo "  2) 上面安装向导会打印管理员账号/密码与后台随机路径(/xxxx)"
echo "  3) 登录后台 -> 系统设置 -> 配置站点/邮箱/支付"
echo "  4) 登录后台 -> 节点配置 -> 设置通讯密钥"
echo "  5) 保存后台输出，后续配置节点后端需用到"
echo "======================================================"
