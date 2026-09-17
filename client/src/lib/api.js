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

// `stores` es la lista de tiendas del hogar ([{id, label}]) — se manda para que la IA reparta
// los ingredientes usando las tiendas reales en vez de asumir Costco/Walmart.
// `lang` es el idioma actualmente seleccionado en la interfaz ('es' | 'en') — se manda para que
// la receta importada quede escrita (nombre, ingredientes, pasos, unidades) en ese idioma.

// Texto de receta pegado a mano -> receta estructurada.
export const extractFromText = (text, stores, lang) => post('/api/extract', { text, stores, lang });

// URL de YouTube -> receta estructurada.
export const importFromYoutube = (url, stores, lang) => post('/api/import-youtube', { url, stores, lang });

// URL de página web (blog de cocina, etc.) -> receta estructurada.
export const importFromUrl = (url, stores, lang) => post('/api/import-url', { url, stores, lang });

// Ingredientes ya estructurados de una receta existente -> { kcal, servings }.
export const estimateKcal = ({ name, ing, steps }) => post('/api/estimate-kcal', { name, ing, steps });
