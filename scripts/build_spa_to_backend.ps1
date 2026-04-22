# Genera el SPA con Vite y lo copia a backend/static (mismo origen en produccion).
# Uso (desde la raiz del repo):  pwsh -File scripts/build_spa_to_backend.ps1
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
if (-not (Test-Path (Join-Path $root 'frontend/package.json'))) {
  Write-Error "Ejecuta este script desde el repo expenseApp (no se encontro frontend/package.json)."
}
Set-Location (Join-Path $root 'frontend')
npm run build
$dist = Join-Path $root 'frontend/dist'
$static = Join-Path $root 'backend/static'
if (Test-Path $static) {
  Remove-Item -Path (Join-Path $static '*') -Recurse -Force
} else {
  New-Item -ItemType Directory -Path $static | Out-Null
}
Copy-Item -Path (Join-Path $dist '*') -Destination $static -Recurse -Force
Write-Host "Listo: contenido de frontend/dist copiado a backend/static"
