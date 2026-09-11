// Construye el prompt de extracción y parsea la respuesta de la IA a un objeto de receta.

// Tiendas por defecto si el cliente no manda las suyas (compatibilidad con llamadas viejas).
export const DEFAULT_STORES = [
  { id: 'costco', label: 'Costco' },
  { id: 'walmart', label: 'Walmart' },
];

export function buildPrompt(source, stores) {
  const list = Array.isArray(stores) && stores.length ? stores : DEFAULT_STORES;
  const storeNames = list.map((s) => s.label).join(' y ');
  const storeExample = list[0]?.id || 'both';
  const storeIdsList = list.map((s) => `"${s.id}" = ${s.label}`).join(', ');

  return `Extrae la(s) receta(s) de este contenido para una familia que compra en ${storeNames}.

Devuelve SOLO JSON válido (sin markdown, sin texto extra) con esta forma exacta:
{"recipes":[{"name":"...","cat":"...","easy":true,"left":true,"types":["cena"],"kcal":650,"servings":4,"steps":["..."],"ing":[{"item":"...","store":"${storeExample}","qty":2,"unit":"unidad","pantry":false}]}]}

Reglas:
- "recipes" es un arreglo: casi siempre tiene un solo elemento, PERO si el contenido describe
  claramente varias recetas distintas (ej. un video "5 recetas mediterráneas" con una receta
  completa por segmento/capítulo), incluye cada una como su propio elemento del arreglo, en el
  orden en que aparecen. No dividas una sola receta en partes — solo cuando de verdad son
  recetas independientes.
- "store" es el id de la tienda donde más comúnmente se compraría ese ingrediente, de esta
  lista: ${storeIdsList}. Si no estás seguro o se consigue en cualquiera de ellas, usa "both".
- "easy": true si se cocina en menos de 30 min o pocos pasos.
- "left": true si rinde como sobras para el almuerzo del día siguiente.
- "types": arreglo con cualquier combinación de "desayuno", "almuerzo", "cena" — cuándo se sirve.
  Úsalo si el título/descripción lo menciona explícitamente (puede ser más de uno). Si no hay
  ninguna señal clara, usa ["cena"].
- "cat": categoría corta (ej. Salvadoreño, Pollo, Pescado, Pasta, Res).
- "steps": pasos cortos en orden. Si el contenido no trae pasos claros, usa [].
- "qty": cantidad numérica si el contenido la menciona (ej. 2, 500). Si no la menciona o es "al gusto", usa null.
- "unit": conviértela SIEMPRE a una de estas opciones exactas, sin importar el idioma original del contenido:
  "unidad", "g", "kg", "ml", "l", "lb", "oz", "taza", "cda", "cdta", "diente". Usa "" si no aplica o no se menciona.
  Equivalencias comunes: cup/cups→taza; tsp/teaspoon→cdta; tbsp/tablespoon→cda; clove/cloves→diente;
  piece/pieces→unidad; pound/pounds→lb; ounce/ounces→oz; gram/grams→g; kilogram/kilo→kg; milliliter→ml; liter/litre→l.
- "pantry": true si es un ingrediente de despensa que casi siempre ya se tiene en casa y no se compra cada semana (sal, especias secas, aceite, azúcar). false para lo demás.
- "kcal": estimación entera de las calorías totales de la receta completa, tal como está
  descrita (todo lo que rinde, no por porción). Es solo un estimado aproximado. Si no hay
  suficiente información para estimarlo, usa null.
- "servings": estimación entera de cuántas porciones rinde la receta tal como está descrita
  (ej. según la cantidad de proteína/ingredientes principales — 6 muslos de pollo suele ser
  para 4-6 personas). Si no se puede estimar, usa null.
- Ingredientes y pasos en español, nombres cortos.

Contenido:
${source}`;
}

const VALID_TYPES = new Set(['desayuno', 'almuerzo', 'cena']);

// Respaldo por si la IA no convierte la unidad como se le pidió (ej. contenido en inglés).
const VALID_UNITS = new Set(['unidad', 'g', 'kg', 'ml', 'l', 'lb', 'oz', 'taza', 'cda', 'cdta', 'diente']);
const UNIT_ALIASES = {
  cup: 'taza', cups: 'taza',
  tsp: 'cdta', teaspoon: 'cdta', teaspoons: 'cdta',
  tbsp: 'cda', tablespoon: 'cda', tablespoons: 'cda',
  clove: 'diente', cloves: 'diente',
  piece: 'unidad', pieces: 'unidad', unit: 'unidad', units: 'unidad',
  pound: 'lb', pounds: 'lb', lbs: 'lb',
  ounce: 'oz', ounces: 'oz',
  gram: 'g', grams: 'g', gr: 'g',
  kilogram: 'kg', kilograms: 'kg', kilo: 'kg', kilos: 'kg',
  milliliter: 'ml', milliliters: 'ml', millilitre: 'ml',
  liter: 'l', liters: 'l', litre: 'l', litres: 'l',
};

function normalizeUnit(raw) {
  const u = typeof raw === 'string' ? raw.trim() : '';
  if (!u) return '';
  const lower = u.toLowerCase();
  if (VALID_UNITS.has(lower)) return lower;
  return UNIT_ALIASES[lower] || u;
}

function normalizeOneRecipe(parsed, validStoreIds) {
  return {
    name: parsed.name || '',
    cat: parsed.cat || 'Otros',
    easy: !!parsed.easy,
    left: !!parsed.left,
    kcal: typeof parsed.kcal === 'number' && !Number.isNaN(parsed.kcal) ? Math.round(parsed.kcal) : null,
    servings: typeof parsed.servings === 'number' && !Number.isNaN(parsed.servings) ? Math.round(parsed.servings) : null,
    types: (() => {
      const t = Array.isArray(parsed.types) ? parsed.types.filter((x) => VALID_TYPES.has(x)) : [];
      return t.length ? t : ['cena'];
    })(),
    steps: Array.isArray(parsed.steps) ? parsed.steps.filter(Boolean) : [],
    ing: Array.isArray(parsed.ing)
      ? parsed.ing
          .filter((g) => g && g.item)
          .map((g) => ({
            item: g.item,
            store: validStoreIds.has(g.store) ? g.store : 'both',
            qty: typeof g.qty === 'number' && !Number.isNaN(g.qty) ? g.qty : null,
            unit: normalizeUnit(g.unit),
            pantry: !!g.pantry,
          }))
      : [],
  };
}

// La IA a veces envuelve el JSON en ```json ... ```; lo limpiamos y recortamos al objeto.
// Devuelve SIEMPRE un arreglo (de 1 elemento en el caso normal de "una sola receta") — ver la
// regla de "recipes" en buildPrompt para cuándo trae más de uno.
export function parseRecipes(text, stores) {
  const validStoreIds = new Set([...(Array.isArray(stores) && stores.length ? stores : DEFAULT_STORES).map((s) => s.id), 'both']);
  const clean = text.replace(/```json|```/g, '').trim();
  const start = clean.indexOf('{');
  const end = clean.lastIndexOf('}');
  if (start === -1 || end === -1) {
    throw new Error('La IA no devolvió un JSON válido.');
  }
  const parsed = JSON.parse(clean.slice(start, end + 1));

  // Respaldo por si la IA ignora el envoltorio "recipes" y devuelve la receta suelta como antes.
  const list = Array.isArray(parsed.recipes) && parsed.recipes.length ? parsed.recipes : [parsed];
  const normalized = list.map((r) => normalizeOneRecipe(r, validStoreIds));

  // Si el contenido no traía suficiente información (video/página sin receta real, o la
  // transcripción automática falló en silencio), la IA a veces devuelve un JSON "vacío" con
  // éxito en vez de fallar — sin esto, el formulario se queda en blanco sin explicar por qué.
  const usable = normalized.filter((r) => r.name || r.ing.length);
  if (!usable.length) {
    throw new Error('No se pudo sacar una receta de ese contenido. Copia el texto de la receta a mano y usa "Extraer con IA".');
  }
  return usable;
}

// Para recetas que ya existen (banco base, o creadas/editadas a mano) y no pasaron por el
// importador: se le pide a la IA un estimado a partir de los ingredientes ya estructurados,
// sin tener que volver a mandar todo el texto/video original.
export function buildKcalPrompt({ name, ing, steps }) {
  const ingLines = (ing || [])
    .filter((g) => g && g.item)
    .map((g) => `- ${[g.qty, g.unit].filter(Boolean).join(' ')} ${g.item}`.trim())
    .join('\n');
  const stepsText = (steps || []).filter(Boolean).join(' ');

  return `Estima las calorías totales y las porciones de esta receta completa (todo lo que
rinde, tal como está descrita). Es una estimación aproximada, no necesita ser exacta.

Receta: ${name || '(sin nombre)'}
Ingredientes:
${ingLines || '(sin ingredientes listados)'}
${stepsText ? `Preparación: ${stepsText}` : ''}

Devuelve SOLO JSON válido (sin markdown, sin texto extra) con esta forma exacta:
{"kcal":650,"servings":4}
Si no se puede estimar alguno de los dos, usa null en ese campo.`;
}

export function parseKcalResponse(text) {
  const clean = String(text || '').replace(/```json|```/g, '').trim();
  const start = clean.indexOf('{');
  const end = clean.lastIndexOf('}');
  if (start === -1 || end === -1) return { kcal: null, servings: null };
  try {
    const parsed = JSON.parse(clean.slice(start, end + 1));
    return {
      kcal: typeof parsed.kcal === 'number' && !Number.isNaN(parsed.kcal) ? Math.round(parsed.kcal) : null,
      servings: typeof parsed.servings === 'number' && !Number.isNaN(parsed.servings) ? Math.round(parsed.servings) : null,
    };
  } catch {
    return { kcal: null, servings: null };
  }
}
