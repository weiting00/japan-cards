#!/bin/bash
# ============================================================================
# japan cards — headless 測試執行器
#
#   ./tests/run.sh              # 跑全部測試
#   ./tests/run.sh dscontract   # 只跑指定測試
#
# 需要：Google Chrome（macOS 預設路徑）、python3
# 測試會把 ../index.html 載入 iframe，驗證資料層、編輯流程、版面與元件契約。
# ============================================================================
set -u

CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
[ -x "$CHROME" ] || CHROME="$(command -v google-chrome || command -v chromium || command -v chromium-browser || true)"
if [ -z "${CHROME:-}" ] || [ ! -x "$CHROME" ]; then
  echo "找不到 Chrome，請安裝 Google Chrome 後再試。" >&2
  exit 1
fi

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$HERE/.." && pwd)"
OUT="$HERE/.out"
mkdir -p "$OUT"

ALL="v3only ed2 ed6 verify layout2 final struct2 migrate carded mobile activityedit dscontract split skin"
FILES="${*:-$ALL}"

# 找一個空的 port 起靜態伺服器（伺服器根目錄＝專案根，測試頁以 /tests/xxx.html 取得）
PORT=""
for p in 8899 8900 8901 8902 8903 8904 8905 8906 8907 8908; do
  if ! nc -z 127.0.0.1 "$p" >/dev/null 2>&1; then PORT="$p"; break; fi
done
[ -z "$PORT" ] && { echo "找不到可用的 port（8899-8908）。" >&2; exit 1; }

( cd "$ROOT" && exec python3 -m http.server "$PORT" --bind 127.0.0.1 >/dev/null 2>&1 ) &
SERVER_PID=$!
trap 'kill $SERVER_PID 2>/dev/null' EXIT INT TERM
sleep 1

TOTAL_PASS=0
TOTAL_FAIL=0
FAILED_FILES=""

for f in $FILES; do
  [ -f "$HERE/$f.html" ] || { echo "找不到測試檔：$f.html"; continue; }
  "$CHROME" --headless=new --disable-gpu --no-sandbox \
            --virtual-time-budget=25000 --window-size=800,900 \
            --dump-dom "http://127.0.0.1:$PORT/tests/$f.html" 2>/dev/null > "$OUT/$f.html"

  RES=$(python3 - "$f" "$OUT/$f.html" <<'PY'
import re, sys, html
name, path = sys.argv[1], sys.argv[2]
src = open(path, encoding="utf-8", errors="replace").read()
m = re.search(r'<pre id="AUDIT">(.*?)</pre>', src, re.S)
if not m:
    print(f"{name}: NO AUDIT BLOCK FOUND")
    sys.exit(0)
text = html.unescape(m.group(1))
fails = [l for l in text.splitlines() if l.startswith("FAIL")]
summ = [l for l in text.splitlines() if "passed," in l]
for l in fails:
    print("  " + l)
print(f"{name}: {summ[0].strip() if summ else 'NO SUMMARY'}")
PY
)
  echo "$RES"
  P=$(echo "$RES" | grep -oE '[0-9]+ passed' | grep -oE '[0-9]+' | head -1)
  F=$(echo "$RES" | grep -oE '[0-9]+ failed' | grep -oE '[0-9]+' | head -1)
  [ -n "$P" ] && TOTAL_PASS=$((TOTAL_PASS + P))
  [ -n "$F" ] && TOTAL_FAIL=$((TOTAL_FAIL + F))
  if [ -n "$F" ] && [ "$F" != "0" ]; then FAILED_FILES="$FAILED_FILES $f"; fi
done

echo "==============================="
echo "TOTAL: $TOTAL_PASS passed, $TOTAL_FAIL failed"
[ -n "$FAILED_FILES" ] && echo "FAILED FILES:$FAILED_FILES"
[ -n "$FAILED_FILES" ] && exit 1
exit 0
