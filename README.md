# Meridian — Deploy en Netlify (paso a paso)

## Requisitos previos

1. Una cuenta en [Netlify](https://netlify.com) (gratis)
2. Una cuenta en [GitHub](https://github.com) (gratis)
3. Una API key de [Anthropic](https://console.anthropic.com) (necesitás créditos)
4. Node.js instalado en tu computadora — descargalo de https://nodejs.org (versión LTS)
5. Git instalado — descargalo de https://git-scm.com

Para verificar que tenés todo instalado, abrí la terminal y ejecutá:

```
node --version
git --version
```

Si ves números de versión, estás bien.

---

## Paso 1 — Probalo en tu computadora

Abrí la terminal, navegá a la carpeta del proyecto y ejecutá:

```bash
cd meridian-project
npm install
npm run dev
```

Se va a abrir en http://localhost:5173. NOTA: en local no va a funcionar la
conexión con la API porque la API key se configura en Netlify. Esto es normal.

---

## Paso 2 — Subí el proyecto a GitHub

2.1. Andá a https://github.com/new y creá un repositorio nuevo llamado `meridian`
(dejalo público o privado, como quieras). NO marques "Add README".

2.2. En tu terminal, dentro de la carpeta del proyecto:

```bash
cd meridian-project
git init
git add .
git commit -m "Meridian v1"
git branch -M main
git remote add origin https://github.com/TU-USUARIO/meridian.git
git push -u origin main
```

Reemplazá `TU-USUARIO` con tu nombre de usuario de GitHub.

---

## Paso 3 — Conectá con Netlify

3.1. Andá a https://app.netlify.com y logueate.

3.2. Hacé click en **"Add new site"** → **"Import an existing project"**.

3.3. Elegí **GitHub** y autorizá el acceso.

3.4. Seleccioná el repositorio `meridian`.

3.5. Netlify va a autodetectar la configuración. Verificá que diga:
   - Build command: `npm run build`
   - Publish directory: `dist`

3.6. Hacé click en **"Deploy site"**.

---

## Paso 4 — Configurá tu API Key (MUY IMPORTANTE)

4.1. En Netlify, andá a tu sitio → **Site configuration** → **Environment variables**.

4.2. Hacé click en **"Add a variable"**.

4.3. Completá:
   - Key: `ANTHROPIC_API_KEY`
   - Value: tu API key de Anthropic (empieza con `sk-ant-...`)

4.4. Guardá.

4.5. Andá a **Deploys** → hacé click en **"Trigger deploy"** → **"Deploy site"**
para que tome la nueva variable.

---

## Paso 5 — ¡Listo!

Tu app va a estar disponible en una URL tipo:
`https://meridian-xxxxx.netlify.app`

Podés cambiar el nombre en **Site configuration** → **Change site name**.

---

## Paso 6 — Instalalo como PWA en tu celular

### iPhone (Safari):
1. Abrí la URL de tu app en Safari
2. Tocá el ícono de compartir (cuadrado con flecha)
3. Elegí **"Agregar a inicio"**
4. Confirmá el nombre y tocá **"Agregar"**

### Android (Chrome):
1. Abrí la URL en Chrome
2. Tocá el menú (3 puntos arriba a la derecha)
3. Elegí **"Instalar app"** o **"Agregar a pantalla de inicio"**
4. Confirmá

La app se va a abrir como si fuera nativa, sin barra de navegador.

---

## Estructura del proyecto

```
meridian-project/
├── index.html              ← Página principal
├── netlify.toml            ← Configuración de Netlify
├── package.json            ← Dependencias
├── vite.config.js          ← Config de Vite
├── public/
│   ├── favicon.svg         ← Ícono del navegador
│   ├── icon-192.png        ← Ícono PWA chico
│   ├── icon-512.png        ← Ícono PWA grande
│   ├── manifest.json       ← Manifiesto PWA
│   └── sw.js               ← Service Worker (offline)
├── netlify/
│   └── functions/
│       └── chat.mjs        ← Función serverless (protege tu API key)
└── src/
    ├── main.jsx            ← Entrada de React
    └── App.jsx             ← La app completa
```

## Costos

- **Netlify**: Gratis (125k function calls/mes en el plan free)
- **Anthropic API**: Pagás por uso. Claude Sonnet cuesta ~$3/millón de tokens de entrada
  y ~$15/millón de salida. Una consulta típica cuesta ~$0.01-0.05.

---

## Troubleshooting

**"API key not configured"**: Revisá que la variable ANTHROPIC_API_KEY esté bien
configurada en Netlify y hacé un nuevo deploy.

**No carga nada**: Abrí las DevTools del navegador (F12) → Console y fijate si hay
errores. Lo más común es que la API key no esté configurada.

**No se instala como PWA**: Asegurate de estar usando HTTPS (Netlify lo da automático).
En iPhone usá Safari, en Android usá Chrome.
"# Investments" 
