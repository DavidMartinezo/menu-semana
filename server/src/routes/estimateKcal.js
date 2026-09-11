// POST /api/estimate-kcal  { name, ing, steps }  ->  { kcal }
// Para recetas que ya existen (banco base, o creadas/editadas a mano) y no pasaron por el
// importador — estima las calorías a partir de los ingredientes ya estructurados.
import { Router } from 'express';
import { complete } from '../services/groq.js';
import { buildKcalPrompt, parseKcal } from '../services/recipe.js';

const router = Router();

router.post('/', async (req, res) => {
  const { name, ing, steps } = req.body || {};
  if (!Array.isArray(ing) || !ing.some((g) => g && g.item)) {
    return res.status(400).json({ error: 'Faltan ingredientes para estimar las calorías.' });
  }
  try {
    const raw = await complete(buildKcalPrompt({ name, ing, steps }));
    res.json({ kcal: parseKcal(raw) });
  } catch (e) {
    console.error('estimate-kcal error:', e);
    res.status(500).json({ error: 'No se pudo estimar las calorías.' });
  }
});

export default router;
