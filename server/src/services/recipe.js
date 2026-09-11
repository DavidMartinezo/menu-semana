// Construye el prompt de extracción y parsea la respuesta de la IA a un objeto de receta.

export function buildPrompt(source) {
  return `Extrae la receta de este contenido para una familia que compra en Costco y Walmart.

Devuelve SOLO JSON válido (sin markdown, sin texto extra) con esta forma exacta:
{"name":"...","cat":"...","easy":true,"left":true,"types":["cena"],"kcal":650,"steps":["..."],"ing":[{"item":"...","store":"costco","qty":2,"unit":"unidad","pantry":false}]}

Reglas:
- "store" es "costco", "walmart" o "both".
- costco: proteínas a granel, arroz, quesos, papas, vegetales a granel, aceite, huevos.
- walmart: especias, hierbas frescas, verduras sueltas, salsas específicas, pan, productos regionales.
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

// La IA a veces envuelve el JSON en ```json ... ```; lo limpiamos y recortamos al objeto.
export function parseRecipe(text) {
  const clean = text.replace(/```json|```/g, '').trim();
  const start = clean.indexOf('{');
  const end = clean.lastIndexOf('}');
  if (start === -1 || end === -1) {
    throw new Error('La IA no devolvió un JSON válido.');
  }
  const parsed = JSON.parse(clean.slice(start, end + 1));

  return {
    name: parsed.name || '',
    cat: parsed.cat || 'Otros',
    easy: !!parsed.easy,
    left: !!parsed.left,
    kcal: typeof parsed.kcal === 'number' && !Number.isNaN(parsed.kcal) ? Math.round(parsed.kcal) : null,
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
            store: ['costco', 'walmart', 'both'].includes(g.store) ? g.store : 'costco',
            qty: typeof g.qty === 'number' && !Number.isNaN(g.qty) ? g.qty : null,
            unit: normalizeUnit(g.unit),
            pantry: !!g.pantry,
          }))
      : [],
  };
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

  return `Estima las calorías totales de esta receta completa (todo lo que rinde, tal como
está descrita, no por porción). Es una estimación aproximada, no necesita ser exacta.

Receta: ${name || '(sin nombre)'}
Ingredientes:
${ingLines || '(sin ingredientes listados)'}
${stepsText ? `Preparación: ${stepsText}` : ''}

Devuelve SOLO un número entero (las kcal totales), sin texto, unidades ni explicación.`;
}

// La IA a veces agrega texto alrededor del número ("Aprox. 650 kcal") pese a que se le pidió
// solo el número — se extrae el primer grupo de dígitos que aparezca en la respuesta.
export function parseKcal(text) {
  const match = String(text || '').match(/\d+/);
  return match ? parseInt(match[0], 10) : null;
}
