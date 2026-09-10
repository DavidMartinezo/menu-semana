// Obtiene el "texto crudo" de una página web de receta para pasárselo a la IA.
//
// Estrategia (de más limpia a más frágil):
//   1) JSON-LD schema.org/Recipe: la mayoría de blogs de cocina lo incluyen para SEO
//      (a veces anidado en un @graph, patrón común en plugins tipo WP Recipe Maker).
//      Trae ingredientes y pasos ya estructurados: es la fuente más confiable.
//   2) Si no hay Recipe en JSON-LD, se cae al texto visible de la página (título + body
//      sin scripts/estilos), recortado para no pasarnos del límite de tokens del modelo.
import dns from 'node:dns/promises';
import net from 'node:net';
import * as cheerio from 'cheerio';

const MAX_HTML_CHARS = 3_000_000; // tope defensivo antes de parsear, por si la página es enorme
const MAX_TEXT_CHARS = 12000; // suficiente para una receta, sin reventar el límite de tokens

const PRIVATE_V4 = [
  /^10\./, /^127\./, /^169\.254\./, /^192\.168\./, /^0\./,
  /^172\.(1[6-9]|2\d|3[0-1])\./,
];

function isPrivateIp(ip) {
  if (net.isIPv4(ip)) return PRIVATE_V4.some((r) => r.test(ip));
  if (net.isIPv6(ip)) {
    const lower = ip.toLowerCase();
    return lower === '::1' || lower.startsWith('fc') || lower.startsWith('fd') || lower.startsWith('fe80') || lower.startsWith('::ffff:127.');
  }
  return true; // no sabemos qué es -> mejor bloquear
}

// Evita que alguien use este endpoint para hacer que el servidor le pegue a su propia
// red interna (localhost, IPs privadas, metadata de la nube, etc.).
async function assertPublicHost(hostname) {
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

function fromVisibleText($) {
  $('script, style, noscript, svg, nav, footer, header, iframe').remove();
  const title = $('title').first().text().trim();
  const body = $('body').text().replace(/\s+/g, ' ').trim();
  const pieces = [];
  if (title) pieces.push(`Título: ${title}`);
  if (body) pieces.push(`Contenido:\n${body}`);
  return pieces.join('\n\n');
}

export async function getRecipeTextFromUrl(rawUrl) {
  const url = new URL(rawUrl);
  if (!['http:', 'https:'].includes(url.protocol)) {
    throw new Error('Esa URL no es válida.');
  }
  await assertPublicHost(url.hostname);

  let res;
  try {
    res = await fetch(url.href, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; MenuSemanaBot/1.0)' },
      redirect: 'follow',
      signal: AbortSignal.timeout(15000),
    });
  } catch {
    throw new Error('No pude abrir esa página. Revisa el enlace.');
  }
  if (!res.ok) {
    throw new Error(`La página respondió con error (${res.status}).`);
  }

  const html = (await res.text()).slice(0, MAX_HTML_CHARS);
  const $ = cheerio.load(html);

  const recipe = fromJsonLd($);
  const text = (recipe ? recipeToText(recipe) : fromVisibleText($)).trim();

  if (!text) {
    throw new Error('No encontré texto de receta en esa página.');
  }
  return text.slice(0, MAX_TEXT_CHARS);
}
