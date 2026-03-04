# Meridian — Deploy en Netlify

## ⚠️ Importante
Netlify necesita GitHub para que las serverless functions funcionen.
El drag & drop NO soporta functions y la app necesita una function
para conectarse a Anthropic (por CORS del navegador).

## Paso 1 — Probar en local

```bash
cd meridian-project
npm install
npm install -g netlify-cli
```

Creá un archivo `.env` en la raíz:
```
ANTHROPIC_API_KEY=sk-ant-tu-clave-aca
```

Levantalo con:
```bash
netlify dev
```

Se abre en http://localhost:8888 con todo funcionando.

## Paso 2 — Subir a GitHub

Creá un repo en github.com/new llamado `meridian`.

```bash
git init
git add .
git commit -m "Meridian v1"
git branch -M main
git remote add origin https://github.com/TU-USUARIO/meridian.git
git push -u origin main
```

## Paso 3 — Deploy en Netlify

1. app.netlify.com → "Add new site" → "Import from GitHub"
2. Seleccioná el repo `meridian`
3. Build command: `npm run build` / Publish: `dist`
4. Deploy

## Paso 4 — API Key

Dos opciones (elegí una):

**Opción A — Desde el navegador (más fácil):**
Abrí la app → te pide la key → pegala → listo.
Queda guardada en tu navegador.

**Opción B — Variable de entorno (más seguro):**
Site configuration → Environment variables → Add:
- Key: `ANTHROPIC_API_KEY`
- Value: `sk-ant-...`
Trigger deploy. Con esto nadie necesita poner key.

## PWA — Instalar en celular

- iPhone: Safari → Compartir → "Agregar a inicio"
- Android: Chrome → Menú → "Instalar app"
