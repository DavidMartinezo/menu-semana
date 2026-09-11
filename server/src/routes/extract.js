// POST /api/extract  { text }  ->  receta estructurada
// Recibe el texto de una receta (pegado a mano) y devuelve el JSON de la receta.
import { Router } from 'express';
import { complete } from '../services/groq.js';
import { buildPrompt, parseRecipes } from '../services/recipe.js';

const router = Router();

router.post('/', async (req, res) => {
  const { text, stores } = req.body || {};
  if (!text || !text.trim()) {
    return res.status(400).json({ error: 'Falta el texto de la receta.' });
  }
  try {
    const raw = await complete(buildPrompt(text, stores));
    res.json({ recipes: parseRecipes(raw, stores) });
  } catch (e) {
    console.error('extract error:', e);
    res.status(500).json({ error: 'No se pudo extraer la receta.' });
  }
});

export default router;
