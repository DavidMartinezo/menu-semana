// POST /api/import-youtube  { url }  ->  receta estructurada
// Saca el texto del video (descripción + transcripción) y lo pasa por la IA.
import { Router } from 'express';
import { complete } from '../services/groq.js';
import { buildPrompt, parseRecipes } from '../services/recipe.js';
import { getRecipeText } from '../services/youtube.js';

const router = Router();

router.post('/', async (req, res) => {
  const { url, stores, lang } = req.body || {};
  if (!url || !url.trim()) {
    return res.status(400).json({ error: 'Falta la URL de YouTube.' });
  }
  try {
    const source = await getRecipeText(url);   // paso 1: conseguir el texto
    const raw = await complete(buildPrompt(source, stores, lang)); // paso 2: IA -> JSON
    const recipes = parseRecipes(raw, stores, lang).map((r) => ({ ...r, videoUrl: url }));
    res.json({ recipes });
  } catch (e) {
    console.error('import-youtube error:', e);
    // e.message trae mensajes útiles (ej. "video sin subtítulos")
    res.status(500).json({ error: e.message || 'No se pudo importar la receta.' });
  }
});

export default router;
