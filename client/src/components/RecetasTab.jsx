import { useState, useMemo } from 'react';
import { Plus, Pencil, Trash2, Search, Youtube, Link as LinkIcon } from 'lucide-react';
import { Tag, StarsDisplay } from './ui.jsx';

const TYPE_META = {
  desayuno: '🌅 Desayuno',
  almuerzo: '🥪 Almuerzo',
  cena: '🌙 Cena',
};

// Texto plano por receta (nombre + categoría + etiquetas) para que la búsqueda encuentre
// tanto "pollo" como "fácil", "favorito" o "desayuno".
const searchable = (m) =>
  [m.name, m.cat, m.easy && 'fácil', m.favorite && 'favorito', m.left && 'rinde', m.healthy && 'saludable', ...(m.types || [])]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

export default function RecetasTab({ meals, setMeals, setEditing, healthyOnly, setHealthyOnly }) {
  const [q, setQ] = useState('');
  const [typeFilter, setTypeFilter] = useState({ desayuno: false, almuerzo: false, cena: false });
  const toggleType = (t) => setTypeFilter((p) => ({ ...p, [t]: !p[t] }));
  const anyTypeSelected = Object.values(typeFilter).some(Boolean);

  const filtered = useMemo(() => {
    let list = meals;
    if (healthyOnly) list = list.filter((m) => m.healthy);
    if (anyTypeSelected) list = list.filter((m) => m.types.some((t) => typeFilter[t]));
    const query = q.trim().toLowerCase();
    if (query) list = list.filter((m) => searchable(m).includes(query));
    return list;
  }, [meals, q, healthyOnly, typeFilter, anyTypeSelected]);

  const cats = [...new Set(filtered.map((m) => m.cat))].sort();

  return (
    <div className="mt-4">
      <button
        onClick={() => setEditing({ name: '', cat: 'Salvadoreño', easy: true, favorite: false, rating: 0, healthy: false, left: true, kcal: null, servings: null, types: ['cena'], steps: [], ing: [] })}
        className="w-full flex items-center justify-center gap-2 bg-emerald-700 hover:bg-emerald-800 text-white font-semibold py-3 rounded-xl shadow-sm mb-4"
      >
        <Plus size={18} /> Agregar comida
      </button>

      <div className="relative mb-3">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar por nombre, categoría o etiqueta…"
          className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-stone-200 bg-white text-sm"
        />
      </div>

      <div className="flex gap-2 mb-4 flex-wrap">
        <button
          onClick={() => setHealthyOnly((v) => !v)}
          className={`px-3 py-1.5 rounded-xl text-xs font-medium shrink-0 ${healthyOnly ? 'bg-lime-600 text-white' : 'bg-white text-stone-500 border border-stone-200'}`}
        >
          🥗 Saludables
        </button>
        {Object.entries(TYPE_META).map(([t, label]) => (
          <button
            key={t}
            onClick={() => toggleType(t)}
            className={`px-3 py-1.5 rounded-xl text-xs font-medium shrink-0 ${typeFilter[t] ? 'bg-emerald-700 text-white' : 'bg-white text-stone-500 border border-stone-200'}`}
          >
            {label}
          </button>
        ))}
      </div>

      {filtered.length === 0 && (
        <p className="text-center text-sm text-stone-400 mt-8">No hay recetas que coincidan.</p>
      )}

      {cats.map((cat) => (
        <div key={cat} className="mb-5">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-stone-400 mb-2">{cat}</h3>
          <div className="space-y-2">
            {filtered.filter((m) => m.cat === cat).map((m) => (
              <div key={m.id} className="bg-white rounded-xl shadow-sm p-3 flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-stone-800 truncate">{m.name}</div>
                  <div className="flex gap-1.5 mt-1 flex-wrap items-center">
                    {m.types?.map((t) => <Tag key={t}>{TYPE_META[t] || t}</Tag>)}
                    {m.easy && <Tag>⚡ Fácil</Tag>}
                    {m.favorite && <Tag>❤️ Favorito</Tag>}
                    {m.rating > 0 && <Tag><StarsDisplay value={m.rating} /></Tag>}
                    {m.healthy && <Tag>🥗 Saludable</Tag>}
                    {m.left && <Tag>Rinde</Tag>}
                    {m.kcal != null && <Tag>~{m.kcal} kcal (receta)</Tag>}
                    {m.kcal != null && m.servings > 0 && <Tag>~{Math.round(m.kcal / m.servings)} kcal/porción</Tag>}
                    <span className="text-xs text-stone-400">{m.ing.length} ingredientes</span>
                    {m.videoUrl && (
                      <a href={m.videoUrl} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}
                        className="flex items-center gap-1 text-xs text-rose-600 hover:underline">
                        <Youtube size={12} /> Ver video
                      </a>
                    )}
                    {m.sourceUrl && (
                      <a href={m.sourceUrl} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}
                        className="flex items-center gap-1 text-xs text-sky-600 hover:underline">
                        <LinkIcon size={12} /> Ver receta
                      </a>
                    )}
                  </div>
                </div>
                <button onClick={() => setEditing(m)} className="p-2 text-stone-400 hover:text-emerald-700"><Pencil size={16} /></button>
                <button
                  onClick={() => { if (confirm(`¿Eliminar "${m.name}"? No se puede deshacer.`)) setMeals((p) => p.filter((x) => x.id !== m.id)); }}
                  className="p-2 text-stone-400 hover:text-rose-600"
                ><Trash2 size={16} /></button>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
