#!/usr/bin/env bash
# Run: sudo bash install.sh
set -Eeuo pipefail

if [[ "$EUID" -ne 0 ]]; then echo 'Запусти: sudo bash install.sh'; exit 1; fi
SRC="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT=/opt/games-local
DB=/var/lib/games-local/games.sqlite
SVC=games-local.service
OLD_SERVER="$ROOT/local/server.mjs"
MILLION_WORKER="$ROOT/local/million-worker.mjs"
NGINX_SNIPPET=/etc/nginx/snippets/games-local.conf
OLD_SITE="$ROOT/public/million"
BACKUP="$ROOT/backups/site3-$(date +%Y%m%d-%H%M%S)"

for f in "$SRC/server.mjs" "$SRC/million-worker.mjs" "$SRC/public/million/index.html" "$SRC/public/million/app.js" "$SRC/public/million/audio.js" "$OLD_SERVER" "$DB"; do
  [[ -f "$f" ]] || { echo "Нет файла: $f"; exit 1; }
done
id games-local >/dev/null 2>&1 || { echo 'Нет пользователя games-local'; exit 1; }
systemctl cat "$SVC" >/dev/null || { echo "Нет службы $SVC"; exit 1; }
mkdir -p "$BACKUP" "$ROOT/public/million"
cp -a "$OLD_SERVER" "$BACKUP/server.mjs"
if [[ -f "$MILLION_WORKER" ]];then cp -a "$MILLION_WORKER" "$BACKUP/million-worker.mjs"; fi
if [[ -f "$NGINX_SNIPPET" ]];then cp -a "$NGINX_SNIPPET" "$BACKUP/games-local.conf"; fi
cp -a "$OLD_SITE" "$BACKUP/million"
printf 'Резервная копия файлов: %s\n' "$BACKUP"

was_active=0
if systemctl is-active --quiet "$SVC";then was_active=1;fi
stopped=0
rollback(){
  local code=$?
  trap - ERR
  echo 'Ошибка установки. Восстанавливаю старые файлы...'
  cp -a "$BACKUP/server.mjs" "$OLD_SERVER" || true
  if [[ -f "$BACKUP/million-worker.mjs" ]];then cp -a "$BACKUP/million-worker.mjs" "$MILLION_WORKER" || true;else rm -f "$MILLION_WORKER";fi
  if [[ -f "$BACKUP/games-local.conf" ]];then
    cp -a "$BACKUP/games-local.conf" "$NGINX_SNIPPET" || true
    nginx -t >/dev/null 2>&1 && systemctl reload nginx || true
  fi
  cp -a "$BACKUP/million/." "$OLD_SITE/" || true
  if [[ "$was_active" == 1 ]];then systemctl restart "$SVC" || true;fi
  echo "Оригиналы сохранены в $BACKUP. Добавленная таблица million_store безопасна и не меняет старые записи."
  exit "$code"
}
trap rollback ERR
if [[ "$was_active" == 1 ]];then systemctl stop "$SVC";stopped=1;fi

# Hot-copying raw SQLite is unsafe during concurrent writes. Perform a consistent SQLite backup.
python3 - "$DB" "$BACKUP/games.sqlite" <<'PY'
import sqlite3,sys
s=sqlite3.connect(f'file:{sys.argv[1]}?mode=ro',uri=True)
d=sqlite3.connect(sys.argv[2]);s.backup(d);d.close();s.close()
PY
chmod 600 "$BACKUP/games.sqlite"

# Migrations run as the same unprivileged account that owns the service database.
runuser -u games-local -- python3 - "$DB" <<'PY'
import sqlite3,sys
c=sqlite3.connect(sys.argv[1],timeout=20)
try:
  c.execute('''CREATE TABLE IF NOT EXISTS million_store (
       key TEXT PRIMARY KEY,
       payload TEXT NOT NULL,
       updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )''')
  c.commit()
finally:c.close()
PY
install -d -m 0750 -o games-local -g games-local /var/lib/games-local/million-audio
cp -a "$SRC/public/million/." "$OLD_SITE/"
install -m 0644 "$SRC/server.mjs" "$OLD_SERVER"
install -m 0644 "$SRC/million-worker.mjs" "$MILLION_WORKER"

# Nginx's original 150k client_max_body_size blocks 25 MB custom sound uploads.
# Change ONLY the /site3/ location; leave /site2/ and all other locations untouched.
if [[ -f "$NGINX_SNIPPET" ]];then
  python3 - "$NGINX_SNIPPET" <<'PYNGINX'
from pathlib import Path
import re,sys
p=Path(sys.argv[1]); src=p.read_text()
m=re.search(r'location\s+\^~\s+/site3/\s*\{[^}]*\}',src,re.S)
if m:
  block=m.group(0)
  updated=re.sub(r'client_max_body_size\s+[^;]+;', 'client_max_body_size 26m;',block,count=1)
  if updated==block and 'client_max_body_size' not in block:
    updated=block[:-1]+'    client_max_body_size 26m;\n}'
  p.write_text(src[:m.start()]+updated+src[m.end():])
else: print('ВНИМАНИЕ: /site3/ не найден в games-local.conf; настройте client_max_body_size 26m вручную')
PYNGINX
  nginx -t
  systemctl reload nginx
fi
node --check "$OLD_SERVER"
node --check "$MILLION_WORKER"
systemctl start "$SVC"
# Check both games, the main web routes, the studio API and audio. No external traffic required.
for path in /site2/ /site3/ /site3/app.js /site3/audio/intro.mp3 /site3/api/studio;do
  response="$(curl -s -o /dev/null -w '%{http_code}' --retry 3 --retry-delay 1 --retry-connrefused "http://127.0.0.1:8082$path")"
  echo "$response $path"
  [[ "$response" == 200 ]] || false
done
trap - ERR
cat <<MSG

ГОТОВО! Игра: https://dirli-server.tail41d437.ts.net/site3/
/site2/ и /site4/ не перенастраивались.
База вопросов осталась: $DB
Резервная копия файлов и базы: $BACKUP
Открой /site3/ и нажми Ctrl+Shift+R. Чтобы начать игру или менять звуки, используй прежний пароль администратора.
MSG
