import { useState } from 'react';
import { ShoppingCart, Check, Plus, Trash2, Search } from 'lucide-react';
import { DAYS } from '../data/seed.js';
import { useT } from '../lib/i18n/LanguageContext.jsx';

// Recordatorio pasivo de "ya compraste esto" — no resta cantidades ni oculta nada, solo
// refresca la memoria de que probablemente todavía tengas algo de eso en la alacena. Deja de
// mostrarse pasado este margen, para no acumular recordatorios ya inútiles.
const RECENT_DAYS = 21;
function lastBoughtLabel(item, purchaseHistory, t) {
  const dateStr = purchaseHistory[item.toLowerCase().trim()];
  if (!dateStr) return null;
  const days = Math.floor((Date.now() - new Date(dateStr + 'T00:00:00').getTime()) / 86400000);
  if (days < 0 || days > RECENT_DAYS) return null;
  if (days === 0) return t('lista.boughtToday');
  if (days === 1) return t('lista.boughtYesterday');
  if (days < 7) return t('lista.boughtDaysAgo', { days });
  const weeks = Math.round(days / 7);
  return t('lista.boughtWeeksAgo', { weeks, plural: weeks > 1 ? 's' : '' });
}

export default function ListaTab({
  shopping, checked, setChecked, plan, bfPlan, lunchPlan, mealById, stores, purchaseHistory, markPurchased,
  extraItems, addExtraItem, toggleExtraItem, removeExtraItem,
}) {
  const { t, lang } = useT();
  // Tiendas disponibles para un producto agregado a mano: las del hogar + la opción fija de
  // "cualquier tienda" (mismo id reservado `both` que ya usan los ingredientes de receta).
  const storeOptions = (stores) => [...stores, { id: 'both', label: t('recetas.anyStore') }];
  const [q, setQ] = useState('');
  const [purchaseDone, setPurchaseDone] = useState(false);
  const [newItemName, setNewItemName] = useState('');
  const [newItemStore, setNewItemStore] = useState(stores[0]?.id || 'both');
  const anyMeals = DAYS.some((d) => mealById[plan[d.key]] || mealById[bfPlan[d.key]] || mealById[lunchPlan[d.key]]);

  // Nombres ya conocidos (aunque estén marcados/tachados) para sugerir mientras se escribe —
  // así no hay que volver a teclear algo que ya se agregó antes.
  const knownItemNames = [...new Set(extraItems.map((x) => x.name))].sort((a, b) => a.localeCompare(b, lang));

  // Si el nombre ya existe en la lista, no se duplica: si estaba tachado (comprado) se
  // desmarca para "pedirlo" de nuevo; si ya estaba activo, no hace falta nada.
  const submitNewItem = () => {
    const trimmed = newItemName.trim();
    if (!trimmed) return;
    const existing = extraItems.find((x) => x.name.toLowerCase() === trimmed.toLowerCase());
    if (existing) {
      if (existing.checked) toggleExtraItem(existing.id);
    } else {
      addExtraItem(trimmed, newItemStore);
    }
    setNewItemName('');
  };

  // Palomear/despalomear mientras compras no registra nada por sí solo — es exploratorio
  // (marcas y desmarcas según lo que vas encontrando). El registro de "esto lo compré" pasa
  // solo cuando decides que ya terminaste (ver completePurchase), reflejando lo que quedó
  // marcado en ese momento, no cada click individual.
  const toggleChecked = (key) => setChecked((c) => ({ ...c, [key]: !c[key] }));

  const anyChecked = [...shopping.byStore.flatMap((g) => g.items), ...shopping.pantry].some((x) => checked[x.key]);
  const completePurchase = () => {
    const allItems = [...shopping.byStore.flatMap((g) => g.items), ...shopping.pantry];
    allItems.filter((x) => checked[x.key]).forEach((x) => markPurchased(x.item));
    setPurchaseDone(true);
    setTimeout(() => setPurchaseDone(false), 1800);
  };

  // Buscar solo filtra lo que se ve: el registro de compra y el palomeado siguen trabajando
  // sobre la lista completa, para que filtrar nunca se coma algo sin que te enteres.
  const query = q.trim().toLowerCase();
  const matches = (name, from = []) =>
    !query || name.toLowerCase().includes(query) || from.some((f) => f.toLowerCase().includes(query));

  // Se busca también por la receta de donde viene el ingrediente ("¿qué llevaba el pollo?"),
  // que es justo lo que ya se muestra a la derecha de cada línea.
  const groups = shopping.byStore
    .map((g) => ({
      ...g,
      items: g.items.filter((x) => matches(x.item, x.from)),
      extras: extraItems.filter((x) => x.store === g.id && matches(x.name)),
    }))
    .filter((g) => g.items.length || g.extras.length);
  const pantry = shopping.pantry.filter((x) => matches(x.item, x.from));

  if (!anyMeals && !extraItems.length) {
    return (
      <div className="mt-10 text-center text-stone-400">
        <ShoppingCart size={32} className="mx-auto mb-2 opacity-40" />
        {t('lista.emptyHint')}
      </div>
    );
  }

  return (
    <div className="mt-4 space-y-4">
      <div className="bg-white rounded-xl shadow-sm p-3">
        <p className="text-xs text-stone-500 mb-2">{t('lista.addExtraHint')}</p>
        <div className="flex gap-2">
          <input
            value={newItemName}
            onChange={(e) => setNewItemName(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') submitNewItem(); }}
            placeholder={t('lista.addExtraPlaceholder')}
            list="extra-item-names"
            className="flex-1 min-w-0 px-3 py-2 rounded-lg border border-stone-200 bg-white text-sm"
          />
          <datalist id="extra-item-names">
            {knownItemNames.map((n) => <option key={n} value={n} />)}
          </datalist>
          <select
            value={newItemStore}
            onChange={(e) => setNewItemStore(e.target.value)}
            className="px-2 py-2 rounded-lg border border-stone-200 bg-white text-sm"
          >
            {storeOptions(stores).map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
          </select>
          <button onClick={submitNewItem} disabled={!newItemName.trim()} className="px-3 rounded-lg bg-emerald-700 hover:bg-emerald-800 disabled:opacity-40 text-white">
            <Plus size={16} />
          </button>
        </div>
      </div>

      <button
        onClick={completePurchase}
        disabled={!anyChecked}
        className={`w-full flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-sm font-medium shadow-sm transition disabled:opacity-40 disabled:cursor-not-allowed ${purchaseDone ? 'bg-emerald-600 text-white' : 'bg-white text-stone-600 hover:bg-stone-100'}`}
      >
        {purchaseDone ? <><Check size={16} /> {t('lista.markedDone')}</> : t('lista.markDone')}
      </button>

      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={t('lista.searchPlaceholder')}
          className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-stone-200 bg-white text-sm"
        />
      </div>

      {query && !groups.length && !pantry.length && (
        <p className="text-center text-sm text-stone-400 py-4">{t('lista.noMatches')}</p>
      )}

      {groups.map(({ id, label, cls, items, extras }) => {
        return (
          <div key={id} className="bg-white rounded-xl shadow-sm overflow-hidden">
            <div className={`px-4 py-2.5 font-semibold text-sm ${cls}`}>{label} · {items.length + extras.length}</div>
            <ul className="divide-y divide-stone-100">
              {items.map((x) => {
                const on = checked[x.key];
                const reminder = !on && lastBoughtLabel(x.item, purchaseHistory, t);
                return (
                  <li key={x.key} onClick={() => toggleChecked(x.key)}
                    className="flex items-center gap-3 px-4 py-2.5 cursor-pointer hover:bg-stone-50">
                    <span className={`w-5 h-5 rounded-md border flex items-center justify-center shrink-0 ${on ? 'bg-emerald-600 border-emerald-600' : 'border-stone-300'}`}>
                      {on && <Check size={14} className="text-white" />}
                    </span>
                    <span className={`flex-1 text-sm ${on ? 'line-through text-stone-300' : 'text-stone-700'}`}>
                      {x.hasQty && <span className="text-stone-400 font-medium">{x.qty}{x.unit ? ` ${x.unit}` : ''} </span>}
                      {x.item}
                      {reminder && <span className="block text-xs text-amber-600 font-normal">🛒 {reminder}</span>}
                    </span>
                    <span className="text-xs text-stone-400 truncate max-w-[45%]">{x.from.join(', ')}</span>
                  </li>
                );
              })}
              {extras.map((x) => {
                const reminder = !x.checked && lastBoughtLabel(x.name, purchaseHistory, t);
                return (
                  <li key={x.id} className="flex items-center gap-3 px-4 py-2.5 hover:bg-stone-50">
                    <span
                      onClick={() => toggleExtraItem(x.id)}
                      className={`w-5 h-5 rounded-md border flex items-center justify-center shrink-0 cursor-pointer ${x.checked ? 'bg-emerald-600 border-emerald-600' : 'border-stone-300'}`}
                    >
                      {x.checked && <Check size={14} className="text-white" />}
                    </span>
                    <span onClick={() => toggleExtraItem(x.id)} className={`flex-1 text-sm cursor-pointer ${x.checked ? 'line-through text-stone-300' : 'text-stone-700'}`}>
                      {x.name}
                      {reminder && <span className="block text-xs text-amber-600 font-normal">🛒 {reminder}</span>}
                    </span>
                    <button onClick={() => removeExtraItem(x.id)} className="p-1 text-stone-300 hover:text-rose-600"><Trash2 size={14} /></button>
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}

      {pantry.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <div className="px-4 py-2.5 font-semibold text-sm bg-stone-100 text-stone-500">{t('lista.pantry')} · {pantry.length}</div>
          <ul className="divide-y divide-stone-100">
            {pantry.map((x) => {
              const on = checked[x.key];
              const reminder = !on && lastBoughtLabel(x.item, purchaseHistory, t);
              return (
                <li key={x.key} onClick={() => toggleChecked(x.key)}
                  className="flex items-center gap-3 px-4 py-2.5 cursor-pointer hover:bg-stone-50">
                  <span className={`w-5 h-5 rounded-md border flex items-center justify-center shrink-0 ${on ? 'bg-emerald-600 border-emerald-600' : 'border-stone-300'}`}>
                    {on && <Check size={14} className="text-white" />}
                  </span>
                  <span className={`flex-1 text-sm ${on ? 'line-through text-stone-300' : 'text-stone-700'}`}>
                    {x.item}
                    {reminder && <span className="block text-xs text-amber-600 font-normal">🛒 {reminder}</span>}
                  </span>
                  <span className="text-xs text-stone-400 truncate max-w-[45%]">{x.from.join(', ')}</span>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
