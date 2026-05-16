#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DEST="$ROOT/android/app/src/main/assets"

if [ ! -d "$DEST/fonts" ]; then
  echo "ERROR: no se encuentra $DEST/fonts — aborta" >&2
  exit 1
fi

echo "Limpiando bundle (conservando fonts/)..."
find "$DEST" -mindepth 1 -maxdepth 1 ! -name 'fonts' -exec rm -rf {} +

echo "Copiando src/herramientas/vanilla/..."
mkdir -p "$DEST/src/herramientas"
cp -R "$ROOT/src/herramientas/vanilla" "$DEST/src/herramientas/vanilla"

echo "Copiando paginas legales al root del bundle..."
[ -f "$ROOT/legal.html" ]   && cp "$ROOT/legal.html"   "$DEST/legal.html"
[ -f "$ROOT/privacy.html" ] && cp "$ROOT/privacy.html" "$DEST/privacy.html"

echo "Copiando imagenes y JS necesarios..."
mkdir -p "$DEST/assets/js"
for logo in logo-kinesislab-negro-hero logo-kinesislab-negro-texto logo-negro; do
  [ -f "$ROOT/assets/${logo}.webp" ] && cp "$ROOT/assets/${logo}.webp" "$DEST/assets/"
done
cp "$ROOT/assets"/mi-foto.webp "$DEST/assets/" 2>/dev/null || true
[ -f "$ROOT/assets/js/wake-lock.js" ] && cp "$ROOT/assets/js/wake-lock.js" "$DEST/assets/js/"
[ -f "$ROOT/assets/js/tts-bridge.js" ] && cp "$ROOT/assets/js/tts-bridge.js" "$DEST/assets/js/"
[ -f "$ROOT/assets/js/cadence-scheduler.js" ] && cp "$ROOT/assets/js/cadence-scheduler.js" "$DEST/assets/js/"

echo "Aplicando transformaciones Android (fonts locales + sin sw-updater)..."
mapfile -t HTML_FILES < <(find "$DEST/src/herramientas/vanilla" -name '*.html' -type f 2>/dev/null; [ -f "$DEST/legal.html" ] && echo "$DEST/legal.html"; [ -f "$DEST/privacy.html" ] && echo "$DEST/privacy.html")

for file in "${HTML_FILES[@]}"; do
  sed -i \
    -e '\|<link[^>]*fonts\.googleapis\.com[^>]*>|d' \
    -e '\|<script[^>]*sw-updater\.js[^>]*></script>|d' \
    -e '\|<link[^>]*rel="manifest"[^>]*>|d' \
    -e '\|<link[^>]*rel="icon"[^>]*>|d' \
    -e '\|<link[^>]*rel="apple-touch-icon"[^>]*>|d' \
    "$file"
  if ! grep -q "local-fonts.css" "$file"; then
    sed -i 's|<head>|<head>\n  <link rel="stylesheet" href="/fonts/local-fonts.css">|' "$file"
  fi
  if ! grep -q 'rel="icon" href="data:' "$file"; then
    sed -i 's|<head>|<head>\n  <link rel="icon" href="data:,">|' "$file"
  fi
done

echo "Sync completado. ${#HTML_FILES[@]} HTML procesados."
