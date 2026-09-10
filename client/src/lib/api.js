// Llamadas al backend. En dev, Vite redirige /api/... al servidor (ver vite.config.js).
// En producción, frontend y backend viven en dominios distintos, así que VITE_API_URL
// (definida al build) apunta a la URL real del backend desplegado.
const API_BASE = import.meta.env.VITE_API_URL || '';

async function post(path, body) {
  const res = await fetch(API_BASE + path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Error ${res.status}`);
  }
  return res.json();
}

// Texto de receta pegado a mano -> receta estructurada.
export const extractFromText = (text) => post('/api/extract', { text });

// URL de YouTube -> receta estructurada.
export const importFromYoutube = (url) => post('/api/import-youtube', { url });

// URL de página web (blog de cocina, etc.) -> receta estructurada.
export const importFromUrl = (url) => post('/api/import-url', { url });
