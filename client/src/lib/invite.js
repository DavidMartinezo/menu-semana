// Invitación por link: https://…/?hogar=CODIGO
//
// El código de un hogar es el uid de su dueño (ver lib/userStorage.js), así que un link de
// invitación es la URL de la app con ese código en la query. Sirve para cualquier cuenta, no
// para una en particular: quien quiera invitar copia SU link desde el panel de Compartir y lo
// manda por WhatsApp; quien lo abre cae en la app ya con la pregunta de unirse.
//
// El código se lee UNA sola vez, al cargar el módulo, y se borra de la barra de direcciones en
// ese mismo momento: así no queda a la vista ni en el historial, y recargar la página no vuelve
// a preguntar lo mismo una y otra vez.
//
// Quien lo consume es App.jsx, no Login.jsx — aunque el link se abra sin sesión. De esa forma
// el "unirse" pasa por el mismo handleJoin que ya usaba el panel de Compartir (un solo camino
// probado) y se evita la carrera de intentar unirse desde Login mientras la sesión recién
// creada ya está montando App.

const PARAM = 'hogar';

function readAndClear() {
  if (typeof window === 'undefined') return null;
  try {
    const url = new URL(window.location.href);
    const code = url.searchParams.get(PARAM);
    if (!code) return null;
    url.searchParams.delete(PARAM);
    window.history.replaceState({}, '', url.pathname + url.search + url.hash);
    return code.trim() || null;
  } catch {
    return null; // URL rara o navegador sin history API: simplemente no hay invitación
  }
}

let pending = readAndClear();

// Hay una invitación esperando en esta carga de la página (la usa Login para el aviso).
export const hasInvite = () => pending !== null;
export const getInvite = () => pending;
export const clearInvite = () => { pending = null; };

// Arma el link para compartir a partir de un código de hogar. Usa la URL real desde donde se
// está corriendo la app, así funciona igual en localhost que en producción sin configurar nada.
export function buildInviteLink(householdId) {
  const { origin, pathname } = window.location;
  return `${origin}${pathname}?${PARAM}=${encodeURIComponent(householdId)}`;
}

// Acepta tanto un código pelado como un link de invitación completo. Hace falta porque quien
// recibe el link por WhatsApp y lo pega en la casilla de "unirme con un código" está pegando
// una URL, no el código — sin esto, esa ruta fallaría sin explicación.
export function parseInviteCode(text) {
  const raw = (text || '').trim();
  if (!raw) return '';
  if (!/^https?:\/\//i.test(raw)) return raw;
  try {
    return new URL(raw).searchParams.get(PARAM)?.trim() || '';
  } catch {
    return raw;
  }
}
