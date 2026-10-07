#!/usr/bin/env bash
# ============================================================
#  面板数据备份脚本
#  用法：bash ops/backup-panel.sh   (建议加入 crontab)
#  备份内容：MariaDB 数据卷 + .env
# ============================================================
set -euo pipefail

PANEL_DIR="${PANEL_DIR:-/opt/xboard}"
BACKUP_DIR="${BACKUP_DIR:-/root/backups/xboard}"
KEEP_DAYS=7
STAMP="$(date +%Y%m%d-%H%M%S)"

mkdir -p "$BACKUP_DIR"
cd "$PANEL_DIR"

echo ">> 备份数据库..."
docker compose exec -T mariadb mysqldump -uroot -p"$(grep '^DB_PASSWORD=' "$PANEL_DIR/.env" | cut -d'"' -f2)" xboard \
  > "$BACKUP_DIR/xboard-db-$STAMP.sql" 2>/dev/null

echo ">> 打包 .env 与数据库..."
tar czf "$BACKUP_DIR/xboard-$STAMP.tar.gz" \
  -C "$PANEL_DIR" .env \
  -C "$BACKUP_DIR" "xboard-db-$STAMP.sql"

rm -f "$BACKUP_DIR/xboard-db-$STAMP.sql"

echo ">> 清理 $KEEP_DAYS 天前的备份..."
find "$BACKUP_DIR" -name 'xboard-*.tar.gz' -mtime +"$KEEP_DAYS" -delete

echo ">> 完成：$BACKUP_DIR/xboard-$STAMP.tar.gz"
