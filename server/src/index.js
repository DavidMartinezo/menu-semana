// Punto de entrada del backend.
// Levanta un servidor Express con estos endpoints:
//   POST /api/extract         -> texto de receta -> receta estructurada (JSON)
//   POST /api/import-youtube  -> URL de YouTube  -> receta estructurada (JSON)
//   POST /api/import-url      -> URL de página web -> receta estructurada (JSON)
import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { rateLimit } from 'express-rate-limit';
import extractRoute from './routes/extract.js';
import youtubeRoute from './routes/importYoutube.js';
import urlRoute from './routes/importUrl.js';

const app = express();

// Render pone la app detrás de un único proxy inverso. Sin esto, el rate limiter de abajo
// vería siempre la IP del proxy (no la del usuario real) y el límite aplicaría a "todos
// mezclados" en vez de por IP real. "1" = confiar solo en ese primer salto, no en cualquier
// X-Forwarded-For que mande el cliente (eso sí sería falsificable).
app.set('trust proxy', 1);

// En dev no hay CLIENT_URL y se permite cualquier origen (localhost en varios puertos).
// En producción, CLIENT_URL debe ser la URL exacta del frontend desplegado — así nadie
// más puede pegarle a esta API desde otro sitio y gastar tu cuota gratis de Groq.
app.use(cors(process.env.CLIENT_URL ? { origin: process.env.CLIENT_URL } : {}));
app.use(express.json({ limit: '1mb' })); // parsea el body JSON de las peticiones

// Límite de peticiones por IP para las 3 rutas que llaman a la IA (o a YouTube/una página
// externa) — son las "caras" en cuota/costo, así que son las que hay que frenar si alguien
// las golpea a mano (fuera del frontend) o con un script. Corre ANTES de la lógica de cada
// ruta, así que ni siquiera se gasta cuota de Groq en las peticiones que se bloquean.
const aiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  limit: 20,                // 20 peticiones por IP por ventana
  standardHeaders: true,    // manda RateLimit-* en la respuesta
  legacyHeaders: false,
  message: { error: 'Demasiadas peticiones. Espera un rato y vuelve a intentar.' },
});

// Chequeo rápido de salud: abre http://localhost:3001/api/health
app.get('/api/health', (_req, res) => res.json({ ok: true }));

app.use('/api/extract', aiLimiter, extractRoute);
app.use('/api/import-youtube', aiLimiter, youtubeRoute);
app.use('/api/import-url', aiLimiter, urlRoute);

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`API escuchando en http://localhost:${PORT}`);
  if (!process.env.GROQ_API_KEY) {
    console.warn('⚠  Falta GROQ_API_KEY en server/.env — la extracción va a fallar.');
  }
});
