// Punto de entrada del backend.
// Levanta un servidor Express con dos endpoints:
//   POST /api/extract         -> texto de receta -> receta estructurada (JSON)
//   POST /api/import-youtube  -> URL de YouTube  -> receta estructurada (JSON)
import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import extractRoute from './routes/extract.js';
import youtubeRoute from './routes/importYoutube.js';

const app = express();

// En dev no hay CLIENT_URL y se permite cualquier origen (localhost en varios puertos).
// En producción, CLIENT_URL debe ser la URL exacta del frontend desplegado — así nadie
// más puede pegarle a esta API desde otro sitio y gastar tu cuota gratis de Groq.
app.use(cors(process.env.CLIENT_URL ? { origin: process.env.CLIENT_URL } : {}));
app.use(express.json({ limit: '1mb' })); // parsea el body JSON de las peticiones

// Chequeo rápido de salud: abre http://localhost:3001/api/health
app.get('/api/health', (_req, res) => res.json({ ok: true }));

app.use('/api/extract', extractRoute);
app.use('/api/import-youtube', youtubeRoute);

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`API escuchando en http://localhost:${PORT}`);
  if (!process.env.GROQ_API_KEY) {
    console.warn('⚠  Falta GROQ_API_KEY en server/.env — la extracción va a fallar.');
  }
});
