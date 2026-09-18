// Obtiene el "texto crudo" de una página web de receta para pasárselo a la IA.
//
// Estrategia (de más limpia a más frágil):
//   1) JSON-LD schema.org/Recipe: la mayoría de blogs de cocina lo incluyen para SEO
//      (a veces anidado en un @graph, patrón común en plugins tipo WP Recipe Maker).
//      Trae ingredientes y pasos ya estructurados: es la fuente más confiable.
//   2) Si no hay Recipe en JSON-LD, se juntan las etiquetas Open Graph (og:title/og:description)
//      con el texto visible de la página (título + body sin scripts/estilos).
//   Todo recortado para no pasarnos del límite de tokens del modelo.
import dns from 'node:dns/promises';
import net from 'node:net';
import * as cheerio from 'cheerio';

const MAX_HTML_CHARS = 3_000_000; // tope defensivo antes de parsear, por si la página es enorme
const MAX_TEXT_CHARS = 12000; // suficiente para una receta, sin reventar el límite de tokens

const PRIVATE_V4 = [
  /^10\./, /^127\./, /^169\.254\./, /^192\.168\./, /^0\./,
  /^172\.(1[6-9]|2\d|3[0-1])\./,
];

export function isPrivateIp(ip) {
  if (net.isIPv4(ip)) return PRIVATE_V4.some((r) => r.test(ip));
  if (net.isIPv6(ip)) {
    const lower = ip.toLowerCase();
    if (lower === '::1' || lower.startsWith('fc') || lower.startsWith('fd') || lower.startsWith('fe80')) return true;
    // IPv4 "mapeada" dentro de IPv6 (ej. "::ffff:10.0.0.1"): hay que revisar la IPv4 embebida
    // con las mismas reglas, no solo el caso de loopback — si no, "::ffff:192.168.1.1" se cuela.
    const mapped = lower.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    if (mapped) return PRIVATE_V4.some((r) => r.test(mapped[1]));
    return false;
  }
  return true; // no sabemos qué es -> mejor bloquear
}

// Evita que alguien use este endpoint para hacer que el servidor le pegue a su propia
// red interna (localhost, IPs privadas, metadata de la nube, etc.).
export async function assertPublicHost(hostname) {
  if (hostname === 'localhost') throw new Error('Esa URL no es válida.');
  let addresses;
  try {
    addresses = await dns.lookup(hostname, { all: true });
  } catch {
    throw new Error('No pude resolver esa dirección.');
  }
  if (!addresses.length || addresses.some((a) => isPrivateIp(a.address))) {
    throw new Error('Esa URL no es válida.');
  }
}

function textFromInstructions(instr) {
  if (!instr) return '';
  if (typeof instr === 'string') return instr;
  if (Array.isArray(instr)) {
    return instr
      .map((step) => {
        if (typeof step === 'string') return step;
        if (step?.itemListElement) return textFromInstructions(step.itemListElement);
        return step?.text || step?.name || '';
      })
      .filter(Boolean)
      .join('\n');
  }
  return '';
}

function findRecipe(node) {
  if (!node) return null;
  if (Array.isArray(node)) {
    for (const n of node) {
      const found = findRecipe(n);
      if (found) return found;
    }
    return null;
  }
  const types = Array.isArray(node['@type']) ? node['@type'] : [node['@type']];
  if (types.includes('Recipe')) return node;
  if (node['@graph']) return findRecipe(node['@graph']);
  return null;
}

function fromJsonLd($) {
  for (const el of $('script[type="application/ld+json"]').toArray()) {
    try {
      const data = JSON.parse($(el).contents().text());
      const recipe = findRecipe(data);
      if (recipe) return recipe;
    } catch {
      // JSON malformado o no relacionado con la receta; seguimos con el siguiente <script>
    }
  }
  return null;
}

function recipeToText(recipe) {
  const pieces = [];
  if (recipe.name) pieces.push(`Título: ${recipe.name}`);
  if (recipe.description) pieces.push(`Descripción: ${recipe.description}`);
  if (Array.isArray(recipe.recipeIngredient) && recipe.recipeIngredient.length) {
    pieces.push(`Ingredientes:\n${recipe.recipeIngredient.join('\n')}`);
  }
  const steps = textFromInstructions(recipe.recipeInstructions);
  if (steps) pieces.push(`Instrucciones:\n${steps}`);
  return pieces.join('\n\n');
}

// Muchas páginas modernas se arman con JavaScript y no traen el contenido en el HTML — el caso
// típico es Instagram, que sin sesión iniciada solo manda el muro de login (el texto visible
// queda en "Log In / Sign Up / Meta / About…"). Pero casi todas llenan las etiquetas Open Graph
// para que el link se vea bien al compartirlo, y ahí sí viene el texto del post con sus saltos
// de línea. En un blog normal esto aporta apenas un resumen corto y el cuerpo sigue mandando,
// así que se agregan siempre, sin tener que adivinar qué tipo de página es.
function fromMetaTags($) {
  const pick = (sel) => $(sel).attr('content')?.trim() || '';
  const title = pick('meta[property="og:title"]') || pick('meta[name="twitter:title"]');
  const description =
    pick('meta[property="og:description"]') ||
    pick('meta[name="twitter:description"]') ||
    pick('meta[name="description"]');
  const pieces = [];
  if (title) pieces.push(`Título: ${title}`);
  if (description) pieces.push(`Descripción: ${description}`);
  return pieces.join('\n');
}

function fromVisibleText($) {
  $('script, style, noscript, svg, nav, footer, header, iframe').remove();
  const title = $('title').first().text().trim();
  const body = $('body').text().replace(/\s+/g, ' ').trim();
  const pieces = [];
  if (title) pieces.push(`Título: ${title}`);
  if (body) pieces.push(`Contenido:\n${body}`);
  return pieces.join('\n\n');
}

const MAX_REDIRECTS = 5;

// Pide la URL sin dejar que fetch siga redirecciones solo: cada salto se valida contra
// assertPublicHost antes de seguirlo. Si no se hiciera así, una URL pública podría redirigir
// a una IP privada (ej. metadata de la nube) y el chequeo inicial no lo agarraría — el chequeo
// de "IP no privada" tiene que aplicar en cada hop, no solo en el primero.
// `fetchImpl` es inyectable para poder probar esta lógica con un fetch falso, sin red real.
async function fetchValidated(startUrl, fetchImpl = fetch) {
  let current = startUrl;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    if (!['http:', 'https:'].includes(current.protocol)) {
      throw new Error('Esa URL no es válida.');
    }
    await assertPublicHost(current.hostname);

    let res;
    try {
      res = await fetchImpl(current.href, {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; MenuSemanaBot/1.0)' },
        redirect: 'manual',
        signal: AbortSignal.timeout(15000),
      });
    } catch {
      throw new Error('No pude abrir esa página. Revisa el enlace.');
    }

    if ([301, 302, 303, 307, 308].includes(res.status)) {
      const location = res.headers.get('location');
      if (!location) throw new Error('La página respondió con una redirección inválida.');
      current = new URL(location, current.href); // la Location puede venir relativa
      continue;
    }
    if (!res.ok) {
      throw new Error(`La página respondió con error (${res.status}).`);
    }
    return res;
  }
  throw new Error('Demasiadas redirecciones.');
}

export async function getRecipeTextFromUrl(rawUrl, fetchImpl = fetch) {
  // new URL() lanza un TypeError con mensaje en inglés ("Invalid URL"), y la ruta devuelve
  // e.message tal cual al cliente — así que se traduce acá al mismo mensaje que usa el resto
  // del archivo para una URL que no se puede aceptar.
  let url;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new Error('Esa URL no es válida.');
  }
  const res = await fetchValidated(url, fetchImpl);

  const html = (await res.text()).slice(0, MAX_HTML_CHARS);
  const $ = cheerio.load(html);

  const recipe = fromJsonLd($);
  // Las meta van primero y se leen antes que fromVisibleText (que borra nodos del documento):
  // así, si la página es enorme y hay que recortar por MAX_TEXT_CHARS, lo que se pierde es la
  // cola del cuerpo y no la vista previa, que suele ser lo más concentrado.
  const text = (recipe ? recipeToText(recipe) : [fromMetaTags($), fromVisibleText($)].filter(Boolean).join('\n\n')).trim();

  if (!text) {
    throw new Error('No encontré texto de receta en esa página.');
  }
  return text.slice(0, MAX_TEXT_CHARS);
}
