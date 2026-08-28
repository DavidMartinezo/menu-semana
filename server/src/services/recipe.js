// Construye el prompt de extracción y parsea la respuesta de la IA a un objeto de receta.

export function buildPrompt(source) {
  return `Extrae la receta de este contenido para una familia que compra en Costco y Walmart.

Devuelve SOLO JSON válido (sin markdown, sin texto extra) con esta forma exacta:
{"name":"...","cat":"...","easy":true,"left":true,"steps":["..."],"ing":[{"item":"...","store":"costco","qty":2,"unit":"unidad","pantry":false}]}

Reglas:
- "store" es "costco", "walmart" o "both".
- costco: proteínas a granel, arroz, quesos, papas, vegetales a granel, aceite, huevos.
- walmart: especias, hierbas frescas, verduras sueltas, salsas específicas, pan, productos regionales.
- "easy": true si se cocina en menos de 30 min o pocos pasos.
- "left": true si rinde como sobras para el almuerzo del día siguiente.
- "cat": categoría corta (ej. Salvadoreño, Pollo, Pescado, Pasta, Res).
- "steps": pasos cortos en orden. Si el contenido no trae pasos claros, usa [].
- "qty": cantidad numérica si el contenido la menciona (ej. 2, 500). Si no la menciona o es "al gusto", usa null.
- "unit": la unidad tal como aparece (ej. "g", "kg", "ml", "unidad", "diente", "taza", "cda", "lb"). Usa "" si no aplica.
- "pantry": true si es un ingrediente de despensa que casi siempre ya se tiene en casa y no se compra cada semana (sal, especias secas, aceite, azúcar). false para lo demás.
- Ingredientes y pasos en español, nombres cortos.

Contenido:
${source}`;
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
    steps: Array.isArray(parsed.steps) ? parsed.steps.filter(Boolean) : [],
    ing: Array.isArray(parsed.ing)
      ? parsed.ing
          .filter((g) => g && g.item)
          .map((g) => ({
            item: g.item,
            store: ['costco', 'walmart', 'both'].includes(g.store) ? g.store : 'costco',
            qty: typeof g.qty === 'number' && !Number.isNaN(g.qty) ? g.qty : null,
            unit: typeof g.unit === 'string' ? g.unit.trim() : '',
            pantry: !!g.pantry,
          }))
      : [],
  };
}
