import { useState } from 'react';
import { X, Plus, Trash2, Sparkles, Youtube, Link as LinkIcon } from 'lucide-react';
import { Toggle, Stars, useBackdropClose } from './ui.jsx';
import { extractFromText, importFromYoutube, importFromUrl, estimateKcal } from '../lib/api.js';

// Aplica una receta devuelta por el backend a los campos del formulario.
// favorite/rating/healthy no vienen de la IA (son gusto personal) — el usuario los pone a mano.
function applyRecipe(parsed, setters) {
  const { setName, setCat, setEasy, setLeft, setTypes, setSteps, setIng, setVideoUrl, setSourceUrl, setKcal } = setters;
  if (parsed.name) setName(parsed.name);
  if (parsed.cat) setCat(parsed.cat);
  if (typeof parsed.easy === 'boolean') setEasy(parsed.easy);
  if (typeof parsed.left === 'boolean') setLeft(parsed.left);
  // Sugerencia de la IA, no autoritativa — el usuario puede corregir los toggles después.
  if (Array.isArray(parsed.types) && parsed.types.length) setTypes(parsed.types);
  if (Array.isArray(parsed.steps)) setSteps(parsed.steps);
  if (Array.isArray(parsed.ing) && parsed.ing.length) setIng(parsed.ing);
  if (parsed.videoUrl) setVideoUrl(parsed.videoUrl);
  if (parsed.sourceUrl) setSourceUrl(parsed.sourceUrl);
  if (typeof parsed.kcal === 'number') setKcal(parsed.kcal);
}

const TYPE_META = [
  ['desayuno', '🌅 Desayuno'],
  ['almuerzo', '🥪 Almuerzo'],
  ['cena', '🌙 Cena'],
];

const UNITS = ['', 'unidad', 'g', 'kg', 'ml', 'l', 'lb', 'oz', 'taza', 'cda', 'cdta', 'diente'];

export default function MealEditor({ meal, onClose, onSave }) {
  const [name, setName] = useState(meal.name);
  const [cat, setCat] = useState(meal.cat);
  const [easy, setEasy] = useState(meal.easy);
  const [favorite, setFavorite] = useState(meal.favorite || false);
  const [rating, setRating] = useState(meal.rating || 0);
  const [healthy, setHealthy] = useState(meal.healthy || false);
  const [left, setLeft] = useState(meal.left);
  const [types, setTypes] = useState(meal.types?.length ? meal.types : ['cena']);
  const [videoUrl, setVideoUrl] = useState(meal.videoUrl || '');
  const [sourceUrl, setSourceUrl] = useState(meal.sourceUrl || '');
  const [steps, setSteps] = useState(meal.steps || []);
  const [ing, setIng] = useState(meal.ing.length ? meal.ing : [{ item: '', store: 'costco', qty: null, unit: '', pantry: false }]);
  const [kcal, setKcal] = useState(meal.kcal ?? null);

  const [url, setUrl] = useState('');
  const [pageUrl, setPageUrl] = useState('');
  const [raw, setRaw] = useState('');
  const [busy, setBusy] = useState('');   // '', 'youtube', 'url', 'text' o 'kcal'
  const [err, setErr] = useState('');

  const setters = { setName, setCat, setEasy, setLeft, setTypes, setSteps, setIng, setVideoUrl, setSourceUrl, setKcal };
  const setIngAt = (i, patch) => setIng((p) => p.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  const toggleType = (t) => setTypes((p) => (p.includes(t) ? p.filter((x) => x !== t) : [...p, t]));

  const runImport = async (kind) => {
    setBusy(kind);
    setErr('');
    try {
      const parsed =
        kind === 'youtube' ? await importFromYoutube(url) :
        kind === 'url' ? await importFromUrl(pageUrl) :
        await extractFromText(raw);
      applyRecipe(parsed, setters);
    } catch (e) {
      setErr(e.message || 'Algo falló. Intenta de nuevo.');
    } finally {
      setBusy('');
    }
  };

  const runEstimateKcal = async () => {
    setBusy('kcal');
    setErr('');
    try {
      const { kcal: estimated } = await estimateKcal({ name, ing, steps });
      setKcal(estimated);
    } catch (e) {
      setErr(e.message || 'Algo falló. Intenta de nuevo.');
    } finally {
      setBusy('');
    }
  };

  const backdrop = useBackdropClose(onClose);

  return (
    <div className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-20 p-0 sm:p-4" {...backdrop}>
      <div className="bg-stone-50 w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-4 py-3 sticky top-0 bg-stone-50 border-b border-stone-200 z-10">
          <h3 className="font-semibold text-stone-800">{meal.id ? 'Editar comida' : 'Nueva comida'}</h3>
          <button onClick={onClose} className="p-1 text-stone-400"><X size={20} /></button>
        </div>

        <div className="p-4 space-y-4">
          {/* Importar desde YouTube */}
          <div className="bg-rose-50 border border-rose-100 rounded-xl p-3">
            <label className="text-xs font-semibold text-rose-700 flex items-center gap-1.5"><Youtube size={14} /> Importar de YouTube</label>
            <p className="text-xs text-stone-500 mt-1">Pega el enlace del video. Traemos la descripción y los subtítulos y sacamos la receta.</p>
            <input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://youtube.com/watch?v=..."
              className="w-full mt-2 px-3 py-2 rounded-lg border border-rose-200 bg-white text-sm"
            />
            <button
              onClick={() => runImport('youtube')}
              disabled={busy !== '' || !url.trim()}
              className="mt-2 w-full flex items-center justify-center gap-2 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white font-medium py-2 rounded-lg text-sm"
            >
              {busy === 'youtube' ? 'Importando…' : <><Youtube size={16} /> Importar receta</>}
            </button>
          </div>

          {/* Importar desde página web */}
          <div className="bg-sky-50 border border-sky-100 rounded-xl p-3">
            <label className="text-xs font-semibold text-sky-700 flex items-center gap-1.5"><LinkIcon size={14} /> Importar desde página web</label>
            <p className="text-xs text-stone-500 mt-1">Pega el enlace de un blog de cocina o receta online. Sacamos la receta del contenido de la página.</p>
            <input
              value={pageUrl}
              onChange={(e) => setPageUrl(e.target.value)}
              placeholder="https://ejemplo.com/receta-de-..."
              className="w-full mt-2 px-3 py-2 rounded-lg border border-sky-200 bg-white text-sm"
            />
            <button
              onClick={() => runImport('url')}
              disabled={busy !== '' || !pageUrl.trim()}
              className="mt-2 w-full flex items-center justify-center gap-2 bg-sky-600 hover:bg-sky-700 disabled:opacity-50 text-white font-medium py-2 rounded-lg text-sm"
            >
              {busy === 'url' ? 'Importando…' : <><LinkIcon size={16} /> Importar receta</>}
            </button>
          </div>

          {/* Extraer de texto pegado */}
          <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-3">
            <label className="text-xs font-semibold text-emerald-800 flex items-center gap-1.5"><Sparkles size={14} /> Extraer con IA (texto)</label>
            <p className="text-xs text-stone-500 mt-1">Pega el texto de la receta (caption de Instagram, etc.) o escribe el platillo.</p>
            <textarea
              value={raw}
              onChange={(e) => setRaw(e.target.value)}
              rows={3}
              placeholder="Ej. Salmón teriyaki con arroz…  o pega la receta completa"
              className="w-full mt-2 px-3 py-2 rounded-lg border border-emerald-200 bg-white text-sm resize-none"
            />
            <button
              onClick={() => runImport('text')}
              disabled={busy !== '' || !raw.trim()}
              className="mt-2 w-full flex items-center justify-center gap-2 bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 text-white font-medium py-2 rounded-lg text-sm"
            >
              {busy === 'text' ? 'Extrayendo…' : <><Sparkles size={16} /> Extraer ingredientes</>}
            </button>
          </div>

          {err && <p className="text-xs text-rose-600 bg-rose-50 border border-rose-100 rounded-lg p-2">{err}</p>}

          {/* Campos editables */}
          <div>
            <label className="text-xs text-stone-500">Nombre</label>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej. Pollo a la plancha"
              className="w-full mt-1 px-3 py-2 rounded-lg border border-stone-200 bg-white" />
          </div>
          <div>
            <label className="text-xs text-stone-500">Categoría</label>
            <input value={cat} onChange={(e) => setCat(e.target.value)} placeholder="Ej. Salvadoreño"
              className="w-full mt-1 px-3 py-2 rounded-lg border border-stone-200 bg-white" />
          </div>
          <div>
            <label className="text-xs text-stone-500">¿Cuándo se sirve? (puede ser más de uno)</label>
            <div className="flex gap-2 mt-1">
              {TYPE_META.map(([t, label]) => (
                <Toggle key={t} on={types.includes(t)} set={() => toggleType(t)} label={label} />
              ))}
            </div>
            {types.length === 0 && (
              <p className="text-xs text-amber-600 mt-1">Sin ningún tipo marcado, esta receta no va a aparecer en los pickers de la semana.</p>
            )}
          </div>
          <div className="flex gap-2">
            <Toggle on={easy} set={setEasy} label="⚡ Fácil" />
            <Toggle on={left} set={setLeft} label="Rinde" />
            <Toggle on={healthy} set={setHealthy} label="🥗 Saludable" />
          </div>
          <div className="flex items-center justify-between gap-2 bg-white border border-stone-200 rounded-lg px-3 py-2">
            <Toggle on={favorite} set={setFavorite} label="❤️ Favorito" />
            <div className="flex items-center gap-2 pl-2">
              <span className="text-xs text-stone-500 whitespace-nowrap">Calificación</span>
              <Stars value={rating} onChange={setRating} />
            </div>
          </div>

          <div>
            <label className="text-xs text-stone-500">Calorías estimadas</label>
            <div className="flex gap-2 mt-1">
              <input
                type="number" min="0" step="1"
                value={kcal ?? ''}
                onChange={(e) => setKcal(e.target.value === '' ? null : Number(e.target.value))}
                placeholder="Ej. 650"
                className="w-28 px-3 py-2 rounded-lg border border-stone-200 bg-white text-sm"
              />
              <button
                onClick={runEstimateKcal}
                disabled={busy !== '' || !ing.some((g) => g.item.trim())}
                className="flex-1 flex items-center justify-center gap-1.5 bg-white border border-stone-200 text-stone-600 hover:bg-stone-100 disabled:opacity-50 text-sm font-medium rounded-lg"
              >
                {busy === 'kcal' ? 'Estimando…' : <><Sparkles size={14} /> Estimar con IA</>}
              </button>
            </div>
            <p className="text-xs text-stone-400 mt-1">Estimación aproximada, no un dato médico.</p>
          </div>

          <div>
            <label className="text-xs text-stone-500 flex items-center gap-1"><Youtube size={12} /> Video de YouTube</label>
            <input value={videoUrl} onChange={(e) => setVideoUrl(e.target.value)} placeholder="https://youtube.com/watch?v=..."
              className="w-full mt-1 px-3 py-2 rounded-lg border border-stone-200 bg-white text-sm" />
          </div>
          <div>
            <label className="text-xs text-stone-500 flex items-center gap-1"><LinkIcon size={12} /> Página de origen</label>
            <input value={sourceUrl} onChange={(e) => setSourceUrl(e.target.value)} placeholder="https://ejemplo.com/receta-de-..."
              className="w-full mt-1 px-3 py-2 rounded-lg border border-stone-200 bg-white text-sm" />
          </div>

          {/* Ingredientes */}
          <div>
            <label className="text-xs text-stone-500">Ingredientes: cantidad, unidad y dónde comprarlos</label>
            <div className="space-y-2 mt-1">
              {ing.map((g, i) => (
                <div key={i} className="p-2 rounded-lg border border-stone-200 bg-white space-y-1.5">
                  <div className="flex gap-2">
                    <input value={g.item} onChange={(e) => setIngAt(i, { item: e.target.value })} placeholder="Ingrediente"
                      className="flex-1 min-w-0 px-3 py-2 rounded-lg border border-stone-200 bg-white text-sm" />
                    <button onClick={() => setIng((p) => p.filter((_, j) => j !== i))} className="px-2 text-stone-400 hover:text-rose-600"><Trash2 size={16} /></button>
                  </div>
                  <div className="flex gap-1.5 items-center">
                    <input type="number" min="0" step="any" value={g.qty ?? ''}
                      onChange={(e) => setIngAt(i, { qty: e.target.value === '' ? null : Number(e.target.value) })}
                      placeholder="Cant."
                      className="w-16 px-2 py-1.5 rounded-lg border border-stone-200 bg-white text-sm" />
                    <select value={g.unit || ''} onChange={(e) => setIngAt(i, { unit: e.target.value })}
                      className="w-20 px-1 py-1.5 rounded-lg border border-stone-200 bg-white text-sm">
                      {UNITS.map((u) => <option key={u} value={u}>{u || '—'}</option>)}
                    </select>
                    <select value={g.store} onChange={(e) => setIngAt(i, { store: e.target.value })}
                      className="flex-1 min-w-0 px-2 py-1.5 rounded-lg border border-stone-200 bg-white text-sm">
                      <option value="costco">Costco</option>
                      <option value="walmart">Walmart</option>
                      <option value="both">Cualquiera</option>
                    </select>
                    <label className="flex items-center gap-1 text-xs text-stone-500 shrink-0 whitespace-nowrap">
                      <input type="checkbox" checked={!!g.pantry} onChange={(e) => setIngAt(i, { pantry: e.target.checked })} />
                      Despensa
                    </label>
                  </div>
                </div>
              ))}
            </div>
            <button onClick={() => setIng((p) => [...p, { item: '', store: 'costco', qty: null, unit: '', pantry: false }])}
              className="mt-2 text-sm text-emerald-700 font-medium flex items-center gap-1"><Plus size={14} /> Agregar ingrediente</button>
          </div>

          {/* Pasos (uno por línea) */}
          <div>
            <label className="text-xs text-stone-500">Pasos (uno por línea)</label>
            <textarea
              value={steps.join('\n')}
              onChange={(e) => setSteps(e.target.value.split('\n'))}
              rows={4}
              placeholder="1. Sazonar el pollo&#10;2. Calentar el sartén…"
              className="w-full mt-1 px-3 py-2 rounded-lg border border-stone-200 bg-white text-sm resize-none"
            />
          </div>
        </div>

        <div className="p-4 sticky bottom-0 bg-stone-50 border-t border-stone-200">
          <button
            onClick={() =>
              name.trim() &&
              onSave({
                ...meal,
                name: name.trim(),
                cat: cat.trim() || 'Otros',
                easy, favorite, rating, healthy, left, types, kcal,
                videoUrl: videoUrl.trim(),
                sourceUrl: sourceUrl.trim(),
                steps: steps.map((s) => s.trim()).filter(Boolean),
                ing: ing.filter((g) => g.item.trim()),
              })
            }
            className="w-full bg-emerald-700 hover:bg-emerald-800 text-white font-semibold py-3 rounded-xl"
          >
            Guardar
          </button>
        </div>
      </div>
    </div>
  );
}
