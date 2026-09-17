import { useState, useMemo } from 'react';
import { Plus, Pencil, Trash2, Search, Youtube, Link as LinkIcon } from 'lucide-react';
import { Tag, StarsDisplay, ConfirmDialog } from './ui.jsx';
import { useT } from '../lib/i18n/LanguageContext.jsx';

const TYPES = ['desayuno', 'almuerzo', 'cena'];

// Texto plano por receta (nombre + categoría + etiquetas) para que la búsqueda encuentre
// tanto "pollo" como "fácil", "favorito" o "desayuno".
const searchable = (m) =>
  [m.name, m.cat, m.easy && 'fácil', m.favorite && 'favorito', m.left && 'rinde', m.healthy && 'saludable', ...(m.types || [])]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

export default function RecetasTab({ meals, setMeals, setEditing, healthyOnly, setHealthyOnly, openView }) {
  const { t } = useT();
  const [q, setQ] = useState('');
  const [typeFilter, setTypeFilter] = useState({ desayuno: false, almuerzo: false, cena: false });
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const toggleType = (tp) => setTypeFilter((p) => ({ ...p, [tp]: !p[tp] }));
  const anyTypeSelected = Object.values(typeFilter).some(Boolean);

  const filtered = useMemo(() => {
    let list = meals;
    if (healthyOnly) list = list.filter((m) => m.healthy);
    if (anyTypeSelected) list = list.filter((m) => m.types.some((tp) => typeFilter[tp]));
    const query = q.trim().toLowerCase();
    if (query) list = list.filter((m) => searchable(m).includes(query));
    return list;
  }, [meals, q, healthyOnly, typeFilter, anyTypeSelected]);

  const cats = [...new Set(filtered.map((m) => m.cat))].sort();

  return (
    <div className="mt-4">
      <button
        data-tour="add-recipe-btn"
        onClick={() => setEditing({ name: '', cat: 'Salvadoreño', easy: true, favorite: false, rating: 0, healthy: false, left: true, kcal: null, servings: null, types: ['cena'], steps: [], ing: [] })}
        className="w-full flex items-center justify-center gap-2 bg-emerald-700 hover:bg-emerald-800 text-white font-semibold py-3 rounded-xl shadow-sm mb-4"
      >
        <Plus size={18} /> {t('recetas.add')}
      </button>

      <div className="relative mb-3">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={t('recetas.searchPlaceholder')}
          className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-stone-200 bg-white text-sm"
        />
      </div>

      <div className="flex gap-2 mb-4 flex-wrap">
        <button
          onClick={() => setHealthyOnly((v) => !v)}
          className={`px-3 py-1.5 rounded-xl text-xs font-medium shrink-0 ${healthyOnly ? 'bg-lime-600 text-white' : 'bg-white text-stone-500 border border-stone-200'}`}
        >
          {t('recetas.healthyFilter')}
        </button>
        {TYPES.map((tp) => (
          <button
            key={tp}
            onClick={() => toggleType(tp)}
            className={`px-3 py-1.5 rounded-xl text-xs font-medium shrink-0 ${typeFilter[tp] ? 'bg-emerald-700 text-white' : 'bg-white text-stone-500 border border-stone-200'}`}
          >
            {t(`type.${tp}`)}
          </button>
        ))}
      </div>

      {filtered.length === 0 && (
        <p className="text-center text-sm text-stone-400 mt-8">{t('recetas.noMatches')}</p>
      )}

      {cats.map((cat) => (
        <div key={cat} className="mb-5">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-stone-400 mb-2">{cat}</h3>
          <div className="space-y-2">
            {filtered.filter((m) => m.cat === cat).map((m) => (
              <div key={m.id} onClick={() => openView(m)} className="bg-white rounded-xl shadow-sm p-3 flex items-center gap-3 cursor-pointer hover:bg-stone-50">
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-stone-800 truncate">{m.name}</div>
                  <div className="flex gap-1.5 mt-1 flex-wrap items-center">
                    {m.types?.map((tp) => <Tag key={tp}>{t(`type.${tp}`)}</Tag>)}
                    {m.easy && <Tag>{t('recetas.easy')}</Tag>}
                    {m.favorite && <Tag>{t('semana.favorite')}</Tag>}
                    {m.rating > 0 && <Tag><StarsDisplay value={m.rating} /></Tag>}
                    {m.healthy && <Tag>{t('semana.healthy')}</Tag>}
                    {m.left && <Tag>{t('recetas.left')}</Tag>}
                    {m.kcal != null && <Tag>{t('semana.kcalRecipe', { kcal: m.kcal })}</Tag>}
                    {m.kcal != null && m.servings > 0 && <Tag>{t('semana.kcalServing', { kcal: Math.round(m.kcal / m.servings) })}</Tag>}
                    <span className="text-xs text-stone-400">{t('recetas.ingredientCount', { count: m.ing.length })}</span>
                    {m.videoUrl && (
                      <a href={m.videoUrl} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}
                        className="flex items-center gap-1 text-xs text-rose-600 hover:underline">
                        <Youtube size={12} /> {t('recetas.viewVideo')}
                      </a>
                    )}
                    {m.sourceUrl && (
                      <a href={m.sourceUrl} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}
                        className="flex items-center gap-1 text-xs text-sky-600 hover:underline">
                        <LinkIcon size={12} /> {t('recetas.viewRecipe')}
                      </a>
                    )}
                  </div>
                </div>
                <button onClick={(e) => { e.stopPropagation(); setEditing(m); }} className="p-2 text-stone-400 hover:text-emerald-700"><Pencil size={16} /></button>
                <button
                  onClick={(e) => { e.stopPropagation(); setConfirmDeleteId(m.id); }}
                  className="p-2 text-stone-400 hover:text-rose-600"
                ><Trash2 size={16} /></button>
              </div>
            ))}
          </div>
        </div>
      ))}

      {confirmDeleteId && (
        <ConfirmDialog
          title={t('recetas.confirmDeleteTitle')}
          message={t('recetas.confirmDeleteMsg', { name: meals.find((m) => m.id === confirmDeleteId)?.name })}
          confirmLabel={t('recetas.confirmDeleteBtn')}
          onConfirm={() => { setMeals((p) => p.filter((x) => x.id !== confirmDeleteId)); setConfirmDeleteId(null); }}
          onCancel={() => setConfirmDeleteId(null)}
        />
      )}
    </div>
  );
}
