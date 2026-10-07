#!/usr/bin/env bash
# ============================================================
#  防火墙配置 (UFW) —— 面板服务器
#  用法：bash ops/firewall-panel.sh
#  说明：只放行必要端口，面板 7001 不对外(仅回环，由反代访问)
# ============================================================
set -euo pipefail

if [ "$(id -u)" -ne 0 ]; then echo "请用 root"; exit 1; fi

if ! command -v ufw >/dev/null 2>&1; then
  apt-get update && apt-get install -y ufw
fi

ssh_port="${SSH_PORT:-22}"
echo ">> SSH 端口: $ssh_port"
ufw allow "$ssh_port"/tcp comment 'SSH'
ufw allow 80/tcp comment 'HTTP'
ufw allow 443/tcp comment 'HTTPS'
ufw allow 443/udp comment 'HTTPS UDP'

echo "y" | ufw enable
ufw status verbose
echo ">> 完成。注意：7001 未开放（面板仅回环，安全）。"
