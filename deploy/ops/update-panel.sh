#!/usr/bin/env bash
# ============================================================
#  面板更新脚本
#  用法：bash ops/update-panel.sh
# ============================================================
set -euo pipefail

PANEL_DIR="${PANEL_DIR:-/opt/xboard}"
cd "$PANEL_DIR"

echo ">> 备份..."
# 复用备份脚本（若存在）
[ -f /opt/backup-panel.sh ] && bash /opt/backup-panel.sh || echo "  跳过备份，(未见 /opt/backup-panel.sh)"

echo ">> 拉取最新镜像并重建..."
docker compose pull
docker compose up -d

echo ">> 清理悬空镜像..."
docker image prune -f

echo ">> 更新完成，查看状态: docker ps"
