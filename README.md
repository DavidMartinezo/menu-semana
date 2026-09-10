# Menú de la semana 🍽️

Planificador de comidas semanal, con:

- Banco de comidas editable (⚡ fácil, ❤️ favorito + calificación de estrellas, 🥗 saludable, "rinde" para sobras),
  con cantidad/unidad por ingrediente y cuáles son "de despensa".
- Días **ocupados configurables** (tú decides cuáles) que filtran el menú a solo recetas fáciles.
- Botón **Sorpréndeme** y un **asistente paso a paso** que arma cenas y desayunos de toda la semana.
- Almuerzo del día siguiente = sobras de la cena de ayer (automático).
- **Lista de compras** consolidada por tienda, con cantidades sumadas y una sección aparte para lo de despensa.
- **Importar recetas desde YouTube, una página web (pegando la URL) o pegando texto** usando IA para sacar ingredientes, cantidades y pasos.

Stack: **React + Vite** (frontend) y **Node + Express** (backend), con Groq (gratis) como motor de IA.

---

## Estructura

```
menu-semana/
├── client/   → app React (Vite + Tailwind v4)
└── server/   → API Node/Express (llama a Anthropic; saca texto de YouTube)
```

El backend existe por dos razones: (1) la API key de Groq **nunca** debe ir en el navegador,
y (2) YouTube no se puede leer desde el frontend (CORS). Toda esa lógica vive en `server/`.

---

## Cómo correrlo

Necesitas **Node 18+**.

```bash
# 1. Instalar dependencias (usa npm workspaces, instala client y server de una vez)
npm install

# 2. Configurar las llaves del backend
cp server/.env.example server/.env
#   edita server/.env y pega tu GROQ_API_KEY (gratis en console.groq.com/keys)

# 3. Arrancar backend + frontend juntos
npm run dev
```

- Frontend: http://localhost:5173
- Backend: http://localhost:3001 (health check en `/api/health`)

Vite redirige automáticamente las llamadas `/api/...` al backend, así que no tienes que tocar URLs.

---

## Variables de entorno (`server/.env`)

| Variable            | Obligatoria | Para qué sirve                                                        |
|---------------------|-------------|----------------------------------------------------------------------|
| `GROQ_API_KEY`      | Sí          | Extraer recetas con IA (gratis). Consíguela en console.groq.com/keys |
| `MODEL`             | No          | Modelo a usar (por defecto `openai/gpt-oss-20b`)                     |
| `YOUTUBE_API_KEY`   | No          | Leer la descripción del video por la vía oficial (recomendado)       |
| `PORT`              | No          | Puerto del backend (por defecto 3001)                                |
| `CLIENT_URL`        | No          | Solo en producción: restringe el CORS al dominio del frontend        |

---

## Cómo funciona la importación de YouTube

`server/src/services/youtube.js` intenta, en orden:

1. **Descripción** vía YouTube Data API v3 (oficial, necesita `YOUTUBE_API_KEY`). Muchos canales
   de cocina ponen la receta completa ahí. Es la vía limpia y dentro de los términos de servicio.
2. **Transcripción** vía la librería `youtube-transcript` (no oficial). Funciona si el video tiene
   subtítulos. Puede romperse si YouTube cambia su sitio y tiene límites de ~100–200 peticiones/hora
   por IP — suficiente para uso personal.

Luego el texto se manda a la IA vía Groq (`server/src/services/recipe.js`), que devuelve la receta como JSON
(nombre, categoría, ingredientes con su tienda, y pasos).

### ¿Quieres algo más robusto?

Cambia `fetchTranscript()` en `youtube.js` por una llamada a [`yt-dlp`](https://github.com/yt-dlp/yt-dlp)
usando `child_process` (maneja más casos borde), o usa un servicio gestionado de transcripciones.
Nota: el scraping de subtítulos va contra los términos de servicio de YouTube en sentido estricto;
la lectura de la descripción vía API oficial no.

---

## Publicar en GitHub

```bash
git init
git add .
git commit -m "Primer commit: planificador de comidas"
git branch -M main
git remote add origin https://github.com/TU_USUARIO/menu-semana.git
git push -u origin main
```

`.gitignore` ya excluye `node_modules/` y `.env`, así que tu API key no se sube. ✅

---

## Publicar gratis (Render)

[Render](https://render.com) tiene tier gratuito tanto para el backend (Web Service) como para el
frontend (Static Site), todo desde un solo dashboard. Este repo ya trae `render.yaml`, así que el
despliegue es semi-automático:

1. Sube el repo a GitHub (ver arriba).
2. En Render: **New > Blueprint**, conecta el repo. Render lee `render.yaml` y crea los 2 servicios
   (`menu-semana-api` y `menu-semana-web`).
3. Cuando te pida las variables marcadas como secretas, pon:
   - En `menu-semana-api`: tu `GROQ_API_KEY` (y `YOUTUBE_API_KEY` si la usas).
   - `CLIENT_URL`: la URL que Render le va a asignar a `menu-semana-web` (algo como
     `https://menu-semana-web.onrender.com`) — la ves en el dashboard del servicio del frontend.
   - En `menu-semana-web`: `VITE_API_URL` = la URL que Render le asignó a `menu-semana-api`
     (algo como `https://menu-semana-api.onrender.com`).
4. Si pusiste `CLIENT_URL`/`VITE_API_URL` después de que ambos servicios ya existían, hace falta un
   **Manual Deploy** en cada uno para que tomen la variable nueva.

**Por qué es seguro:** las API keys viven solo como variables de entorno en Render, nunca en el
código ni en el repo. El backend, con `CLIENT_URL` puesto, solo acepta peticiones desde tu frontend
— así nadie más puede usar tu cuota gratis de Groq pegándole directo a la API.

**Limitación del tier gratis:** el backend "se duerme" tras ~15 min sin tráfico y tarda unos segundos
en responder la primera petición después de eso. Para uso familiar ocasional no se nota.

Cada quien que abra la app guarda su propio plan en el `localStorage` de su navegador — no hay una
base de datos compartida, así que cada visitante ve/edita solo lo suyo.

---

## Groq gratis: límites a tener en cuenta

El tier gratuito de Groq tiene límites de peticiones por minuto/día que varían por modelo (ver
[console.groq.com/docs/rate-limits](https://console.groq.com/docs/rate-limits)). Para uso personal
(importar unas cuantas recetas a la semana) sobra de sobra.

---

## Ideas para seguir trabajando

- Importar **varias recetas de golpe** (pegar varias URLs).
- Guardar el plan en un backend real (base de datos) para verlo desde el teléfono y la compu.
- Exportar la lista directo a Google Keep vía su API.
- Regla "no repetir la misma proteína dos días seguidos" en Sorpréndeme.
- Escalar porciones según cuánta gente come.
