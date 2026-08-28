// Obtiene el "texto crudo" de un video de YouTube para pasárselo a la IA.
//
// Estrategia (de más limpia a más frágil):
//   1) Descripción vía YouTube Data API v3 (oficial, necesita YOUTUBE_API_KEY).
//      Muchos canales de cocina ponen la receta completa ahí.
//   2) Transcripción vía la librería youtube-transcript (NO oficial).
//      Funciona si el video tiene subtítulos; puede romperse si YouTube cambia su sitio,
//      y tiene límites de ~100-200 peticiones/hora por IP. Suficiente para uso personal.
//
// Si algún día quieres algo más robusto, cambia fetchTranscript() por una llamada a
// `yt-dlp` mediante child_process (ver README), o un servicio gestionado.
import { YoutubeTranscript } from 'youtube-transcript';

// Saca el ID de 11 caracteres de cualquier forma de URL de YouTube (o de un ID pelado).
export function getVideoId(url) {
  const patterns = [
    /[?&]v=([\w-]{11})/,
    /youtu\.be\/([\w-]{11})/,
    /shorts\/([\w-]{11})/,
    /embed\/([\w-]{11})/,
  ];
  for (const p of patterns) {
    const m = url.match(p);
    if (m) return m[1];
  }
  if (/^[\w-]{11}$/.test(url.trim())) return url.trim();
  return null;
}

async function fetchDescription(videoId) {
  const key = process.env.YOUTUBE_API_KEY;
  if (!key) return null; // sin API key, saltamos este paso
  const u = `https://www.googleapis.com/youtube/v3/videos?part=snippet&id=${videoId}&key=${key}`;
  const res = await fetch(u);
  if (!res.ok) return null;
  const data = await res.json();
  const snip = data.items?.[0]?.snippet;
  return snip ? { title: snip.title, description: snip.description } : null;
}

async function fetchTranscript(videoId) {
  try {
    const parts = await YoutubeTranscript.fetchTranscript(videoId);
    return parts.map((p) => p.text).join(' ');
  } catch {
    return null; // el video puede no tener subtítulos, o la librería falló
  }
}

// Junta título + descripción + transcripción en un solo bloque de texto.
export async function getRecipeText(url) {
  const videoId = getVideoId(url);
  if (!videoId) throw new Error('No reconocí un ID de video en esa URL.');

  const [desc, transcript] = await Promise.all([
    fetchDescription(videoId),
    fetchTranscript(videoId),
  ]);

  const pieces = [];
  if (desc?.title) pieces.push(`Título: ${desc.title}`);
  if (desc?.description) pieces.push(`Descripción:\n${desc.description}`);
  if (transcript) pieces.push(`Transcripción:\n${transcript}`);

  if (!pieces.length) {
    throw new Error(
      'No encontré descripción ni subtítulos en ese video. Copia el texto de la receta a mano y usa "Extraer con IA".'
    );
  }
  return pieces.join('\n\n');
}
