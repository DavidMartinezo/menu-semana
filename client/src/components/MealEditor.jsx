import { useState, useRef, useEffect } from 'react';
import { X, Plus, Trash2, Sparkles, Youtube, Link as LinkIcon, ChevronDown } from 'lucide-react';
import { Toggle, Stars, useBackdropClose, useLockBodyScroll } from './ui.jsx';
import { extractFromText, importFromYoutube, importFromUrl, estimateKcal } from '../lib/api.js';
import { useT } from '../lib/i18n/LanguageContext.jsx';

// Aplica una receta devuelta por el backend a los campos del formulario.
// favorite/rating/healthy no vienen de la IA (son gusto personal) — el usuario los pone a mano.
// `ingredientStores` es la memoria del hogar (App.jsx) de a qué tienda quedó asociado cada
// ingrediente la última vez que se guardó una receta con él — se usa para pisar lo que diga la
// IA en esta importación y que un mismo ingrediente no termine en tiendas distintas según qué
// receta lo trajo (ver plan de consolidación de la lista de compras).
function applyRecipe(parsed, setters, ingredientStores) {
  const { setName, setCat, setEasy, setLeft, setTypes, setSteps, setIng, setVideoUrl, setSourceUrl, setKcal, setServings } = setters;
  if (parsed.name) setName(parsed.name);
  if (parsed.cat) setCat(parsed.cat);
  if (typeof parsed.easy === 'boolean') setEasy(parsed.easy);
  if (typeof parsed.left === 'boolean') setLeft(parsed.left);
  // Sugerencia de la IA, no autoritativa — el usuario puede corregir los toggles después.
  if (Array.isArray(parsed.types) && parsed.types.length) setTypes(parsed.types);
  if (Array.isArray(parsed.steps)) setSteps(parsed.steps);
  if (Array.isArray(parsed.ing) && parsed.ing.length) {
    setIng(parsed.ing.map((g) => {
      const remembered = ingredientStores[g.item?.toLowerCase().trim()];
      return remembered ? { ...g, store: remembered } : g;
    }));
  }
  if (parsed.videoUrl) setVideoUrl(parsed.videoUrl);
  if (parsed.sourceUrl) setSourceUrl(parsed.sourceUrl);
  if (typeof parsed.kcal === 'number') setKcal(parsed.kcal);
  if (typeof parsed.servings === 'number') setServings(parsed.servings);
}

const TYPES = ['desayuno', 'almuerzo', 'cena'];

const UNITS_BY_LANG = {
  es: ['', 'unidad', 'g', 'kg', 'ml', 'l', 'lb', 'oz', 'taza', 'cda', 'cdta', 'diente'],
  en: ['', 'unit', 'g', 'kg', 'ml', 'l', 'lb', 'oz', 'cup', 'tbsp', 'tsp', 'clove'],
};

export default function MealEditor({ meal, categories = [], stores = [], ingredientStores = {}, onClose, onSave }) {
  const { t, lang } = useT();
  const UNITS = UNITS_BY_LANG[lang] || UNITS_BY_LANG.es;
  const defaultStoreId = stores[0]?.id || 'both';
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
  const [ing, setIng] = useState(meal.ing.length ? meal.ing : [{ item: '', store: defaultStoreId, qty: null, unit: '', pantry: false }]);
  const [kcal, setKcal] = useState(meal.kcal ?? null);
  const [servings, setServings] = useState(meal.servings ?? null);

  const [url, setUrl] = useState('');
  const [pageUrl, setPageUrl] = useState('');
  const [raw, setRaw] = useState('');
  const [busy, setBusy] = useState('');   // '', 'youtube', 'url', 'text' o 'kcal'
  const [err, setErr] = useState('');
  const [kcalErr, setKcalErr] = useState('');
  const [multiRecipes, setMultiRecipes] = useState(null); // varias recetas detectadas, sin elegir aún
  // Los 3 métodos de importar son un acordeón de una sola selección — en la práctica se usa
  // uno solo por receta, así que no tiene sentido tenerlos los 3 expandidos a la vez.
  const [importMethod, setImportMethod] = useState(null); // null | 'youtube' | 'url' | 'text'
  const toggleImportMethod = (m) => setImportMethod((cur) => (cur === m ? null : m));

  const setters = { setName, setCat, setEasy, setLeft, setTypes, setSteps, setIng, setVideoUrl, setSourceUrl, setKcal, setServings };
  const setIngAt = (i, patch) => setIng((p) => p.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  const toggleType = (tp) => setTypes((p) => (p.includes(tp) ? p.filter((x) => x !== tp) : [...p, tp]));

  const runImport = async (kind) => {
    setBusy(kind);
    setErr('');
    setMultiRecipes(null);
    try {
      const { recipes } =
        kind === 'youtube' ? await importFromYoutube(url, stores, lang) :
        kind === 'url' ? await importFromUrl(pageUrl, stores, lang) :
        await extractFromText(raw, stores, lang);
      if (recipes.length > 1) {
        setMultiRecipes(recipes); // el contenido trae varias recetas — que el usuario elija cuál
      } else {
        applyRecipe(recipes[0], setters, ingredientStores);
      }
    } catch (e) {
      setErr(e.message || t('recetas.genericError'));
    } finally {
      setBusy('');
    }
  };

  const runEstimateKcal = async () => {
    setBusy('kcal');
    setKcalErr('');
    try {
      const result = await estimateKcal({ name, ing, steps });
      if (result.kcal == null) {
        setKcalErr(t('recetas.estimateFailed'));
      } else {
        setKcal(result.kcal);
        if (result.servings != null) setServings(result.servings);
      }
    } catch (e) {
      setKcalErr(e.message || t('recetas.genericError'));
    } finally {
      setBusy('');
    }
  };

  const hasIngredients = ing.some((g) => g.item.trim());

  // La caja de pasos crece con lo que se escribe en vez de quedarse en un alto fijo con scroll
  // propio — escribir 8 pasos dentro de una ventanita de 4 líneas era lo más incómodo del
  // formulario. El tope (max-h en las clases) evita que una receta larga empuje todo el modal.
  const stepsRef = useRef(null);
  useEffect(() => {
    const el = stepsRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }, [steps]);

  const backdrop = useBackdropClose(onClose);
  useLockBodyScroll();

  return (
    <div className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-20 p-0 sm:p-4" {...backdrop}>
      <div className="bg-stone-50 w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl max-h-[90vh] overflow-y-auto overscroll-contain" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-4 py-3 sticky top-0 bg-stone-50 border-b border-stone-200 z-10">
          <h3 className="font-semibold text-stone-800">{meal.id ? t('recetas.editMeal') : t('recetas.newMeal')}</h3>
          <button onClick={onClose} className="p-1 text-stone-400"><X size={20} /></button>
        </div>

        <div className="p-4 space-y-4">
          {/* Importar desde YouTube */}
          <div className="bg-rose-50 border border-rose-100 rounded-xl overflow-hidden">
            <button
              type="button"
              onClick={() => toggleImportMethod('youtube')}
              className="w-full flex items-center justify-between gap-1.5 p-3 text-left"
            >
              <span className="text-xs font-semibold text-rose-700 flex items-center gap-1.5"><Youtube size={14} /> {t('recetas.importYoutubeTitle')}</span>
              <ChevronDown size={16} className={`text-rose-400 shrink-0 transition-transform ${importMethod === 'youtube' ? 'rotate-180' : ''}`} />
            </button>
            {importMethod === 'youtube' && (
              <div className="px-3 pb-3">
                <p className="text-xs text-stone-500">{t('recetas.importYoutubeHint')}</p>
                <input
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder={t('recetas.importYoutubePlaceholder')}
                  className="w-full mt-2 px-3 py-2 rounded-lg border border-rose-200 bg-white text-sm"
                />
                <button
                  onClick={() => runImport('youtube')}
                  disabled={busy !== '' || !url.trim()}
                  className="mt-2 w-full flex items-center justify-center gap-2 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white font-medium py-2 rounded-lg text-sm"
                >
                  {busy === 'youtube' ? t('recetas.importing') : <><Youtube size={16} /> {t('recetas.importRecipe')}</>}
                </button>
              </div>
            )}
          </div>

          {/* Importar desde página web */}
          <div className="bg-sky-50 border border-sky-100 rounded-xl overflow-hidden">
            <button
              type="button"
              onClick={() => toggleImportMethod('url')}
              className="w-full flex items-center justify-between gap-1.5 p-3 text-left"
            >
              <span className="text-xs font-semibold text-sky-700 flex items-center gap-1.5"><LinkIcon size={14} /> {t('recetas.importWebTitle')}</span>
              <ChevronDown size={16} className={`text-sky-400 shrink-0 transition-transform ${importMethod === 'url' ? 'rotate-180' : ''}`} />
            </button>
            {importMethod === 'url' && (
              <div className="px-3 pb-3">
                <p className="text-xs text-stone-500">{t('recetas.importWebHint')}</p>
                <input
                  value={pageUrl}
                  onChange={(e) => setPageUrl(e.target.value)}
                  placeholder={t('recetas.importWebPlaceholder')}
                  className="w-full mt-2 px-3 py-2 rounded-lg border border-sky-200 bg-white text-sm"
                />
                <button
                  onClick={() => runImport('url')}
                  disabled={busy !== '' || !pageUrl.trim()}
                  className="mt-2 w-full flex items-center justify-center gap-2 bg-sky-600 hover:bg-sky-700 disabled:opacity-50 text-white font-medium py-2 rounded-lg text-sm"
                >
                  {busy === 'url' ? t('recetas.importing') : <><LinkIcon size={16} /> {t('recetas.importRecipe')}</>}
                </button>
              </div>
            )}
          </div>

          {/* Extraer de texto pegado */}
          <div className="bg-emerald-50 border border-emerald-100 rounded-xl overflow-hidden">
            <button
              type="button"
              onClick={() => toggleImportMethod('text')}
              className="w-full flex items-center justify-between gap-1.5 p-3 text-left"
            >
              <span className="text-xs font-semibold text-emerald-800 flex items-center gap-1.5"><Sparkles size={14} /> {t('recetas.extractTitle')}</span>
              <ChevronDown size={16} className={`text-emerald-600 shrink-0 transition-transform ${importMethod === 'text' ? 'rotate-180' : ''}`} />
            </button>
            {importMethod === 'text' && (
              <div className="px-3 pb-3">
                <p className="text-xs text-stone-500">{t('recetas.extractHint')}</p>
                <textarea
                  value={raw}
                  onChange={(e) => setRaw(e.target.value)}
                  rows={3}
                  placeholder={t('recetas.extractPlaceholder')}
                  className="w-full mt-2 px-3 py-2 rounded-lg border border-emerald-200 bg-white text-sm resize-none"
                />
                <button
                  onClick={() => runImport('text')}
                  disabled={busy !== '' || !raw.trim()}
                  className="mt-2 w-full flex items-center justify-center gap-2 bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 text-white font-medium py-2 rounded-lg text-sm"
                >
                  {busy === 'text' ? t('recetas.extracting') : <><Sparkles size={16} /> {t('recetas.extractIngredients')}</>}
                </button>
              </div>
            )}
          </div>

          {err && <p className="text-xs text-rose-600 bg-rose-50 border border-rose-100 rounded-lg p-2">{err}</p>}

          {multiRecipes && (
            <div className="bg-amber-50 border border-amber-100 rounded-xl p-3">
              <p className="text-xs font-semibold text-amber-700 mb-2">
                {t('recetas.multiRecipeHint')}
              </p>
              <div className="space-y-1.5">
                {multiRecipes.map((r, i) => (
                  <button
                    key={i}
                    onClick={() => { applyRecipe(r, setters, ingredientStores); setMultiRecipes(null); }}
                    className="w-full text-left px-3 py-2 rounded-lg bg-white border border-amber-200 text-sm text-stone-700 hover:bg-amber-100"
                  >
                    {r.name || t('recetas.recipeN', { n: i + 1 })}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Campos editables */}
          <div>
            <label className="text-xs text-stone-500">{t('recetas.name')}</label>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder={t('recetas.namePlaceholder')}
              className="w-full mt-1 px-3 py-2 rounded-lg border border-stone-200 bg-white" />
          </div>
          <div>
            <label className="text-xs text-stone-500">{t('recetas.category')}</label>
            <input value={cat} onChange={(e) => setCat(e.target.value)} placeholder={t('recetas.categoryPlaceholder')} list="meal-categories"
              className="w-full mt-1 px-3 py-2 rounded-lg border border-stone-200 bg-white" />
            <datalist id="meal-categories">
              {categories.map((c) => <option key={c} value={c} />)}
            </datalist>
          </div>
          <div>
            <label className="text-xs text-stone-500">{t('recetas.whenServed')}</label>
            <div className="flex gap-2 mt-1">
              {TYPES.map((tp) => (
                <Toggle key={tp} on={types.includes(tp)} set={() => toggleType(tp)} label={t(`type.${tp}`)} />
              ))}
            </div>
            {types.length === 0 && (
              <p className="text-xs text-amber-600 mt-1">{t('recetas.noTypeWarning')}</p>
            )}
          </div>
          <div className="flex gap-2">
            <Toggle on={easy} set={setEasy} label={t('recetas.easy')} />
            <Toggle on={left} set={setLeft} label={t('recetas.rinde')} />
            <Toggle on={healthy} set={setHealthy} label={t('semana.healthy')} />
          </div>
          <div className="flex items-center justify-between gap-2 bg-white border border-stone-200 rounded-lg px-3 py-2">
            <Toggle on={favorite} set={setFavorite} label={t('semana.favorite')} />
            <div className="flex items-center gap-2 pl-2">
              <span className="text-xs text-stone-500 whitespace-nowrap">{t('recetas.rating')}</span>
              <Stars value={rating} onChange={setRating} />
            </div>
          </div>

          <div>
            <label className="text-xs text-stone-500">{t('recetas.kcalLabel')}</label>
            <div className="flex gap-2 mt-1">
              <input
                type="number" min="0" step="1"
                value={kcal ?? ''}
                onChange={(e) => setKcal(e.target.value === '' ? null : Number(e.target.value))}
                placeholder={t('recetas.kcalTotal')}
                className="w-28 px-3 py-2 rounded-lg border border-stone-200 bg-white text-sm"
              />
              <input
                type="number" min="1" step="1"
                value={servings ?? ''}
                onChange={(e) => setServings(e.target.value === '' ? null : Number(e.target.value))}
                placeholder={t('recetas.servings')}
                className="w-24 px-3 py-2 rounded-lg border border-stone-200 bg-white text-sm"
              />
              <button
                onClick={runEstimateKcal}
                disabled={busy !== '' || !hasIngredients}
                className="flex-1 flex items-center justify-center gap-1.5 bg-white border border-stone-200 text-stone-600 hover:bg-stone-100 disabled:opacity-50 text-sm font-medium rounded-lg"
              >
                {busy === 'kcal' ? t('recetas.estimating') : <><Sparkles size={14} /> {t('recetas.estimateAI')}</>}
              </button>
            </div>
            {kcal != null && servings != null && servings > 0 && (
              <p className="text-xs text-emerald-700 mt-1">{t('recetas.perServing', { kcal: Math.round(kcal / servings), servings })}</p>
            )}
            {!hasIngredients ? (
              <p className="text-xs text-amber-600 mt-1">{t('recetas.needIngredients')}</p>
            ) : (
              <p className="text-xs text-stone-400 mt-1">{t('recetas.estimateNote')}</p>
            )}
            {kcalErr && <p className="text-xs text-rose-600 bg-rose-50 border border-rose-100 rounded-lg p-2 mt-1.5">{kcalErr}</p>}
          </div>

          <div>
            <label className="text-xs text-stone-500 flex items-center gap-1"><Youtube size={12} /> {t('recetas.videoLabel')}</label>
            <input value={videoUrl} onChange={(e) => setVideoUrl(e.target.value)} placeholder={t('recetas.importYoutubePlaceholder')}
              className="w-full mt-1 px-3 py-2 rounded-lg border border-stone-200 bg-white text-sm" />
          </div>
          <div>
            <label className="text-xs text-stone-500 flex items-center gap-1"><LinkIcon size={12} /> {t('recetas.sourceLabel')}</label>
            <input value={sourceUrl} onChange={(e) => setSourceUrl(e.target.value)} placeholder={t('recetas.importWebPlaceholder')}
              className="w-full mt-1 px-3 py-2 rounded-lg border border-stone-200 bg-white text-sm" />
          </div>

          {/* Ingredientes */}
          <div>
            <label className="text-xs text-stone-500">{t('recetas.ingredientsLabel')}</label>
            <div className="space-y-2 mt-1">
              {ing.map((g, i) => (
                <div key={i} className="p-2 rounded-lg border border-stone-200 bg-white space-y-1.5">
                  <div className="flex gap-2">
                    <input value={g.item} onChange={(e) => setIngAt(i, { item: e.target.value })} placeholder={t('recetas.ingredientPlaceholder')}
                      className="flex-1 min-w-0 px-3 py-2 rounded-lg border border-stone-200 bg-white text-sm" />
                    <button onClick={() => setIng((p) => p.filter((_, j) => j !== i))} className="px-2 text-stone-400 hover:text-rose-600"><Trash2 size={16} /></button>
                  </div>
                  <div className="flex gap-1.5 items-center">
                    <input type="number" min="0" step="any" value={g.qty ?? ''}
                      onChange={(e) => setIngAt(i, { qty: e.target.value === '' ? null : Number(e.target.value) })}
                      placeholder={t('recetas.qtyPlaceholder')}
                      className="w-16 px-2 py-1.5 rounded-lg border border-stone-200 bg-white text-sm" />
                    <select value={g.unit || ''} onChange={(e) => setIngAt(i, { unit: e.target.value })}
                      className="w-20 px-1 py-1.5 rounded-lg border border-stone-200 bg-white text-sm">
                      {UNITS.map((u) => <option key={u} value={u}>{u || '—'}</option>)}
                    </select>
                    <select value={g.store} onChange={(e) => setIngAt(i, { store: e.target.value })}
                      className="flex-1 min-w-0 px-2 py-1.5 rounded-lg border border-stone-200 bg-white text-sm">
                      {stores.map((s) => <option key={s.id} value={s.id}>{s.label || t('recetas.noName')}</option>)}
                      <option value="both">{t('recetas.anyStore')}</option>
                    </select>
                    <label className="flex items-center gap-1 text-xs text-stone-500 shrink-0 whitespace-nowrap">
                      <input type="checkbox" checked={!!g.pantry} onChange={(e) => setIngAt(i, { pantry: e.target.checked })} />
                      {t('recetas.pantryCheckbox')}
                    </label>
                  </div>
                </div>
              ))}
            </div>
            <button onClick={() => setIng((p) => [...p, { item: '', store: defaultStoreId, qty: null, unit: '', pantry: false }])}
              className="mt-2 text-sm text-emerald-700 font-medium flex items-center gap-1"><Plus size={14} /> {t('recetas.addIngredient')}</button>
          </div>

          {/* Pasos (uno por línea) */}
          <div>
            <label className="text-xs text-stone-500">{t('recetas.stepsLabel')}</label>
            <textarea
              ref={stepsRef}
              value={steps.join('\n')}
              onChange={(e) => setSteps(e.target.value.split('\n'))}
              placeholder={t('recetas.stepsPlaceholder')}
              className="w-full mt-1 px-3 py-2 rounded-lg border border-stone-200 bg-white text-sm resize-none overflow-y-auto overscroll-contain min-h-[7rem] max-h-[50vh]"
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
                easy, favorite, rating, healthy, left, types, kcal, servings,
                videoUrl: videoUrl.trim(),
                sourceUrl: sourceUrl.trim(),
                steps: steps.map((s) => s.trim()).filter(Boolean),
                ing: ing.filter((g) => g.item.trim()),
              })
            }
            className="w-full bg-emerald-700 hover:bg-emerald-800 text-white font-semibold py-3 rounded-xl"
          >
            {t('recetas.save')}
          </button>
        </div>
      </div>
    </div>
  );
}
