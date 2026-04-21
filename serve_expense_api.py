#!/usr/bin/env python3
"""
Arranque de la API cuando el hosting ejecuta el comando desde la raíz del monorepo
(sin "Root Directory" = backend). Hace chdir a backend/ y lanza uvicorn.
"""
import os
import sys

_BACKEND_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "backend")
os.chdir(_BACKEND_DIR)
sys.path.insert(0, _BACKEND_DIR)

if __name__ == "__main__":
    import uvicorn

    port = int(os.environ.get("PORT", "8000"))
    uvicorn.run("app.main:app", host="0.0.0.0", port=port)
