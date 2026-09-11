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

## Variables de entorno (`client/.env`)

| Variable            | Obligatoria | Para qué sirve                                                        |
|---------------------|-------------|------------------------------------------------------------------------|
| `VITE_API_URL`      | Solo en prod | URL del backend desplegado (ver abajo)                               |
| `VITE_POSTHOG_KEY`  | No          | Analítica (PostHog). Sin esto, la app no manda ningún dato.           |
| `VITE_POSTHOG_HOST` | No          | Host de tu proyecto PostHog (por defecto `https://us.i.posthog.com`) |
| `VITE_FIREBASE_API_KEY` | Sí      | Config del proyecto de Firebase (login + datos) — ver abajo           |
| `VITE_FIREBASE_AUTH_DOMAIN` | Sí  | Config del proyecto de Firebase                                       |
| `VITE_FIREBASE_PROJECT_ID` | Sí   | Config del proyecto de Firebase                                       |
| `VITE_FIREBASE_STORAGE_BUCKET` | Sí | Config del proyecto de Firebase                                     |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | Sí | Config del proyecto de Firebase                                |
| `VITE_FIREBASE_APP_ID` | Sí       | Config del proyecto de Firebase                                       |

### Login y datos (Firebase)

La app se puede usar con cuenta de Google, o **como invitado** ("Usar sin cuenta" en la pantalla
de login) con una cuenta anónima real de Firebase — temporal, sin correo, que Firebase borra sola
tras 30 días sin usarse. Cada cuenta tiene su propio banco de recetas y planes, guardado en
Firestore — nada de `localStorage` compartido entre cuentas.

Los datos de cada quien viven en `households/{id}` (por defecto, `id` es tu propio uid). Se pueden
**compartir** entre dos cuentas de Google (ej. entre esposos) desde el botón "Compartir" en el
header: uno copia su código y el otro lo pega para unirse — desde ese momento ambas cuentas ven y
editan el mismo banco de recetas y plan, desde cualquier dispositivo, para siempre (como compartir
una nota de Google Keep), hasta que alguna de las dos cuentas decida "Salir del hogar compartido".
El puntero de "a qué hogar pertenezco" vive en `users/{uid}` (uno por cuenta, no por dispositivo).

Pasos manuales en [Firebase Console](https://console.firebase.google.com) (no se pueden hacer desde código):
1. **Authentication > Sign-in method** → habilitar los proveedores "Google" y "Anónimo" (para el
   modo invitado) — en "Anónimo", dejar marcada la limpieza automática de cuentas inactivas (30 días).
2. **Firestore Database** → crear la base (modo producción).
3. **Firestore > Rules** → pegar:
   ```
   rules_version = '2';
   service cloud.firestore {
     match /databases/{database}/documents {
       // Puntero de cada cuenta: siempre puede leer/escribir el suyo, nada más.
       match /users/{uid} {
         allow read, write: if request.auth != null && request.auth.uid == uid;
       }

       match /households/{householdId} {
         allow read, write: if isOwner(householdId) || isMember(householdId);
         allow update: if isSelfJoin(householdId);
         allow create: if isSelfJoinCreate(householdId);

         function isOwner(id) {
           return request.auth != null && request.auth.uid == id;
         }
         function isMember(id) {
           return request.auth != null && request.auth.uid in resource.data.get('members', []);
         }
         function isSelfJoin(id) {
           let before = resource.data.get('members', []);
           let after = request.resource.data.get('members', []);
           return request.auth != null &&
             !(request.auth.uid in before) &&
             request.resource.data.diff(resource.data).affectedKeys().hasOnly(['members']) &&
             after == before.concat([request.auth.uid]);
         }
         function isSelfJoinCreate(id) {
           return request.auth != null &&
             request.auth.uid != id &&
             request.resource.data.diff({}).affectedKeys().hasOnly(['members']) &&
             request.resource.data.members == [request.auth.uid];
         }
       }

       match /{document=**} {
         allow read, write: if false;
       }
     }
   }
   ```
   Con esto: el dueño de un hogar y quien ya esté en `members` tienen acceso total; alguien ajeno
   solo puede agregarse a sí mismo a `members` (sin tocar nada más) — esa es la operación de
   "unirme", sin necesitar Cloud Functions (quedan fuera del plan gratis de Firebase). Riesgo
   aceptado a propósito: conocer el código de un hogar alcanza para unirse una vez, sin
   aprobación — igual que "cualquiera con el link edita" en un Google Doc; suficiente para
   compartir en familia, no pensado para un producto público.
4. **Authentication > Settings > Authorized domains** → confirmar que están `localhost` y el
   dominio de producción (ej. `menu-semana-web.onrender.com`).
5. Copia la config de tu app web (**Configuración del proyecto > tus apps**) a las 6 variables
   `VITE_FIREBASE_*` de arriba (en `client/.env` local, y en Render para producción).

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
   - `VITE_POSTHOG_KEY` (opcional): tu clave de proyecto de [PostHog](https://posthog.com)
     (gratis hasta 1M eventos/mes). Si la dejas vacía, la app simplemente no manda analítica.
   - Las 6 `VITE_FIREBASE_*` (obligatorias): la config de tu proyecto de Firebase — ver la
     sección "Login y datos (Firebase)" arriba.
4. Si pusiste `CLIENT_URL`/`VITE_API_URL` después de que ambos servicios ya existían, hace falta un
   **Manual Deploy** en cada uno para que tomen la variable nueva.

**Por qué es seguro:** las API keys viven solo como variables de entorno en Render, nunca en el
código ni en el repo. El backend, con `CLIENT_URL` puesto, solo acepta peticiones desde tu frontend
— así nadie más puede usar tu cuota gratis de Groq pegándole directo a la API.

**Limitación del tier gratis:** el backend "se duerme" tras ~15 min sin tráfico y tarda unos segundos
en responder la primera petición después de eso. Para uso familiar ocasional no se nota.

Cada quien que abra la app inicia sesión (con Google o como invitado) y su plan se guarda en
Firestore, no en el `localStorage` del navegador — ver la sección "Login y datos (Firebase)" arriba.

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
