# Meridian — Investment Intelligence Dashboard

## Deploy en Netlify

### Opción 1: GitHub (recomendada)

```bash
cd meridian-deploy
git init
git add .
git commit -m "Meridian v2"
git remote add origin https://github.com/TU_USUARIO/meridian.git
git push -u origin main
```

Después en Netlify:
1. New site → Import from Git → tu repo
2. Build command: `npm run build`
3. Publish directory: `dist`
4. (Opcional) En Site Settings → Environment Variables → agregar `ANTHROPIC_API_KEY`

### Opción 2: Netlify CLI

```bash
cd meridian-deploy
npm install
npm run build
npx netlify-cli deploy --build --prod
```

### Opción 3: Local

```bash
cd meridian-deploy
npm install
npm install -g netlify-cli
echo "ANTHROPIC_API_KEY=tu-key-aqui" > .env
netlify dev
```

Abre http://localhost:8888

## API Key

La app acepta API key de dos formas:
1. **Variable de entorno** `ANTHROPIC_API_KEY` en Netlify (recomendada)
2. **Ingreso manual** en la pantalla de inicio (se guarda en localStorage del navegador)
