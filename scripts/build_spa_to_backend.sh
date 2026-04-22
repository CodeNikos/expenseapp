#!/usr/bin/env bash
# Genera el SPA y lo copia a backend/static. Uso: bash scripts/build_spa_to_backend.sh
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT/frontend"
npm run build
STATIC="$ROOT/backend/static"
rm -rf "${STATIC:?}"/*
mkdir -p "$STATIC"
cp -r "$ROOT/frontend/dist/"* "$STATIC/"
echo "Listo: frontend/dist copiado a backend/static"
