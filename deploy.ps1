# Script de deployment rápido para Netlify (PowerShell)
# Uso: .\deploy.ps1 [-prod]

param(
    [switch]$prod
)

Write-Host "🚀 Iniciando deployment de Veritly..." -ForegroundColor Cyan

# Build del proyecto
Write-Host "📦 Building web app..." -ForegroundColor Yellow
npm run build:web

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Error en el build. Abortando deployment." -ForegroundColor Red
    exit 1
}

Write-Host "✅ Build completado exitosamente!" -ForegroundColor Green

# Verificar si se especificó producción
if ($prod.IsPresent) {
    Write-Host "🌟 Deploying a PRODUCCIÓN..." -ForegroundColor Magenta
    netlify deploy --prod --dir=dist
}
else {
    Write-Host "🧪 Deploying a PREVIEW..." -ForegroundColor Yellow
    netlify deploy --dir=dist
}

Write-Host "✨ Deployment completado!" -ForegroundColor Green
