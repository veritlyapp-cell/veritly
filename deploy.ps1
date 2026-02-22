
# Simple deploy script
Write-Host "🚀 Deploying to PROD..."
cmd /c "npm run build:web"
if ($LASTEXITCODE -ne 0) { exit 1 }
cmd /c "npx netlify deploy --dir=dist --prod"
