#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
if grep -R "REEMPLAZAR" "$ROOT/frontend/config.js" "$ROOT/backend/.clasp.json" 2>/dev/null; then
  echo "Configuración incompleta: reemplazá todos los valores REEMPLAZAR." >&2
  exit 1
fi
node --check "$ROOT/frontend/config.js"
node --check "$ROOT/frontend/assets/app.js"
echo "Configuración y sintaxis frontend: OK"
