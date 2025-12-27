#!/bin/bash

# Script de deployment rápido para Netlify
# Uso: ./deploy.sh [prod|dev]

echo "🚀 Iniciando deployment de Veritly..."

# Build del proyecto
echo "📦 Building web app..."
npm run build:web

if [ $? -ne 0 ]; then
    echo "❌ Error en el build. Abortando deployment."
    exit 1
fi

echo "✅ Build completado exitosamente!"

# Verificar si se especificó producción
if [ "$1" = "prod" ]; then
    echo "🌟 Deploying a PRODUCCIÓN..."
    netlify deploy --prod --dir=dist
else
    echo "🧪 Deploying a PREVIEW..."
    netlify deploy --dir=dist
fi

echo "✨ Deployment completado!"
