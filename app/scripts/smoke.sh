#!/bin/bash
# Stage 3 app smoke test：建置後用 headless Chrome 確認 route 外殼與 engine bridge。
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$HERE"

[ -d dist ] || npm run build

CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
[ -x "$CHROME" ] || CHROME="$(command -v google-chrome || command -v chromium || command -v chromium-browser || true)"
if [ -z "${CHROME:-}" ] || [ ! -x "$CHROME" ]; then
  echo "找不到 Chrome，請安裝 Google Chrome 後再試。" >&2
  exit 1
fi

PORT=""
for p in 8911 8912 8913 8914 8915; do
  if ! nc -z 127.0.0.1 "$p" >/dev/null 2>&1; then PORT="$p"; break; fi
done
[ -n "$PORT" ] || { echo "找不到可用的 port。" >&2; exit 1; }

python3 -m http.server "$PORT" --bind 127.0.0.1 --directory dist >/dev/null 2>&1 &
PID=$!
PROFILE="$(mktemp -d "${TMPDIR:-/tmp}/jc-stage3-smoke.XXXXXX")"
trap 'kill "$PID" 2>/dev/null; rm -rf "$PROFILE"' EXIT INT TERM
sleep 1

DOM="$("$CHROME" --headless=new --disable-gpu --no-sandbox \
  --user-data-dir="$PROFILE" --no-first-run --no-default-browser-check \
  --virtual-time-budget=4000 --window-size=390,844 \
  --dump-dom "http://127.0.0.1:$PORT/" 2>/dev/null)"

for needle in "engine.js only" "共用資料層已連線" "刷卡決策" "額度" "記帳" "攻略"; do
  if ! printf '%s' "$DOM" | grep -q "$needle"; then
    echo "app smoke FAILED：找不到「${needle}」" >&2
    exit 1
  fi
done

echo "app smoke: ok"
