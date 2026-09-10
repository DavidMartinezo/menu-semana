// POST /api/import-url  { url }  ->  receta estructurada
// Saca el texto de una página web (blog de cocina, etc.) y lo pasa por la IA.
import { Router } from 'express';
import { complete } from '../services/groq.js';
import { buildPrompt, parseRecipe } from '../services/recipe.js';
import { getRecipeTextFromUrl } from '../services/webpage.js';

const router = Router();

router.post('/', async (req, res) => {
  const { url } = req.body || {};
  if (!url || !url.trim()) {
    return res.status(400).json({ error: 'Falta la URL de la página.' });
  }
  try {
    const source = await getRecipeTextFromUrl(url.trim());
    const raw = await complete(buildPrompt(source));
    res.json({ ...parseRecipe(raw), sourceUrl: url.trim() });
  } catch (e) {
    console.error('import-url error:', e);
    res.status(500).json({ error: e.message || 'No se pudo importar la receta.' });
  }
});

export default router;
