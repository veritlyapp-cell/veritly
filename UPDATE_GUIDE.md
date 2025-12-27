# Guía Rápida: Actualizar Veritly en Netlify

## 🚀 Método Rápido (Deploy Manual)

### Cada vez que hagas cambios:

```powershell
# 1. Build
npm run build:web

# 2. Deploy a producción
netlify deploy --prod --dir=dist
```

### O usa el script todo-en-uno:
```powershell
.\deploy.ps1 -prod
```

---

## ⚡ Método Automático (GitHub Integration)

### Configuración inicial (solo una vez):

1. **Sube tu código a GitHub:**
```bash
git add .
git commit -m "Latest changes"
git push origin main
```

2. **Conecta Netlify con GitHub:**
   - Ve a: https://app.netlify.com/sites/veritly/settings/deploys
   - En "Build & deploy" → "Continuous Deployment"
   - Click "Link repository"
   - Selecciona GitHub y autoriza
   - Selecciona tu repositorio

3. **Configura el build:**
   - Build command: `npm run build:web`
   - Publish directory: `dist`
   - Click "Save"

### Después de configurarlo:

```bash
# Cada vez que hagas cambios:
git add .
git commit -m "Descripción de cambios"
git push origin main

# ¡Netlify se actualiza automáticamente! 🎉
```

---

## 📋 Resumen Rápido

| Método | Cuándo Usar | Comando |
|--------|-------------|---------|
| **Script rápido** | Actualización inmediata | `.\deploy.ps1 -prod` |
| **Manual** | Control total | `npm run build:web` + `netlify deploy --prod --dir=dist` |
| **GitHub** | Mejor para producción | `git push` (auto-deploy) |

---

## 💡 Tips

- **Siempre haz build primero** antes de deploy manual
- **Verifica en preview** antes de producción: `netlify deploy --dir=dist`
- **Variables de entorno** se configuran en Netlify, no en el código

---
