// Analítica ligera con PostHog (gratis hasta 1M eventos/mes). Es opcional: sin
// VITE_POSTHOG_KEY definida en el build, initAnalytics() y track() no hacen nada — y,
// gracias al import() dinámico, ni siquiera se descarga el SDK de PostHog (~100KB) para
// quienes no tienen la analítica activada, en vez de cargarlo siempre en el bundle principal.
const KEY = import.meta.env.VITE_POSTHOG_KEY;
const HOST = import.meta.env.VITE_POSTHOG_HOST || 'https://us.i.posthog.com';

let posthogPromise = null;
const loadPosthog = () => {
  if (!KEY) return null;
  if (!posthogPromise) posthogPromise = import('posthog-js').then((m) => m.default);
  return posthogPromise;
};

export async function initAnalytics() {
  const posthog = await loadPosthog();
  if (!posthog) return;
  posthog.init(KEY, {
    api_host: HOST,
    capture_pageview: true, // carga inicial de la app
    person_profiles: 'identified_only', // no crea perfil de persona solo por visitar
  });
}

// Evento propio (ej. cambio de pestaña) — captura "qué partes de la app usa la gente",
// que un pageview normal no distingue porque esto es una sola página (SPA).
export async function track(event, props) {
  const posthog = await loadPosthog();
  if (!posthog) return;
  posthog.capture(event, props);
}
