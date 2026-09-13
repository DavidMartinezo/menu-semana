import { useState } from 'react';
import { ShoppingCart, Check, Plus, Trash2 } from 'lucide-react';
import { DAYS, storeMeta } from '../data/seed.js';
import { CopyBtn } from './ui.jsx';

// Recordatorio pasivo de "ya compraste esto" — no resta cantidades ni oculta nada, solo
// refresca la memoria de que probablemente todavía tengas algo de eso en la alacena. Deja de
// mostrarse pasado este margen, para no acumular recordatorios ya inútiles.
const RECENT_DAYS = 21;
function lastBoughtLabel(item, purchaseHistory) {
  const dateStr = purchaseHistory[item.toLowerCase().trim()];
  if (!dateStr) return null;
  const days = Math.floor((Date.now() - new Date(dateStr + 'T00:00:00').getTime()) / 86400000);
  if (days < 0 || days > RECENT_DAYS) return null;
  if (days === 0) return 'comprado hoy';
  if (days === 1) return 'comprado ayer';
  if (days < 7) return `comprado hace ${days} días`;
  const weeks = Math.round(days / 7);
  return `comprado hace ${weeks} semana${weeks > 1 ? 's' : ''}`;
}

// Tiendas disponibles para un producto agregado a mano: las del hogar + la opción fija de
// "cualquier tienda" (mismo id reservado `both` que ya usan los ingredientes de receta).
const storeOptions = (stores) => [...stores, { id: 'both', label: 'Cualquier tienda' }];

export default function ListaTab({
  shopping, checked, setChecked, plan, bfPlan, lunchPlan, mealById, stores, purchaseHistory, markPurchased,
  extraItems, addExtraItem, toggleExtraItem, removeExtraItem,
}) {
  const [copied, setCopied] = useState('');
  const [purchaseDone, setPurchaseDone] = useState(false);
  const [newItemName, setNewItemName] = useState('');
  const [newItemStore, setNewItemStore] = useState(stores[0]?.id || 'both');
  const anyMeals = DAYS.some((d) => mealById[plan[d.key]] || mealById[bfPlan[d.key]] || mealById[lunchPlan[d.key]]);

  const submitNewItem = () => {
    if (!newItemName.trim()) return;
    addExtraItem(newItemName, newItemStore);
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

  const copyText = async (text, label) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = text; document.body.appendChild(ta); ta.select();
      try { document.execCommand('copy'); } catch { /* noop */ }
      document.body.removeChild(ta);
    }
    setCopied(label);
    setTimeout(() => setCopied(''), 1800);
  };

  const qtyPrefix = (x) => (x.hasQty ? `${x.qty}${x.unit ? ' ' + x.unit : ''} ` : '');

  const byStoreText = () => {
    let out = '🛒 LISTA DE COMPRAS\n';
    for (const { id, label, items } of shopping.byStore) {
      const extras = extraItems.filter((x) => x.store === id);
      if (!items.length && !extras.length) continue;
      out += `\n— ${label.toUpperCase()} —\n`;
      items.forEach((x) => (out += `☐ ${qtyPrefix(x)}${x.item}\n`));
      extras.forEach((x) => (out += `☐ ${x.name}\n`));
    }
    if (shopping.pantry.length) {
      out += '\n— DE DESPENSA (revisar si hay) —\n';
      shopping.pantry.forEach((x) => (out += `☐ ${x.item}\n`));
    }
    return out.trim();
  };

  const byRecipeText = () => {
    let out = '';
    const addMeal = (m) => {
      if (!m) return;
      out += `${m.name}\n`;
      m.ing.forEach((g) => {
        const qty = typeof g.qty === 'number' ? `${g.qty}${g.unit ? ' ' + g.unit : ''} ` : '';
        out += `  • ${qty}${g.item} (${storeMeta(g.store, stores).label}${g.pantry ? ', despensa' : ''})\n`;
      });
      out += '\n';
    };
    for (const d of DAYS) {
      addMeal(mealById[bfPlan[d.key]]);
      // El almuerzo solo se lista si se eligió a mano (ver mismo criterio en shopping, App.jsx).
      if (lunchPlan[d.key]) addMeal(mealById[lunchPlan[d.key]]);
      addMeal(mealById[plan[d.key]]);
    }
    if (extraItems.length) {
      out += 'Otros\n';
      extraItems.forEach((x) => (out += `  • ${x.name} (${storeMeta(x.store, stores).label})\n`));
    }
    return out.trim();
  };

  if (!anyMeals && !extraItems.length) {
    return (
      <div className="mt-10 text-center text-stone-400">
        <ShoppingCart size={32} className="mx-auto mb-2 opacity-40" />
        Elige cenas en la pestaña <span className="font-medium text-stone-500">Semana</span> y aquí aparece la lista lista para tus tiendas.
      </div>
    );
  }

  return (
    <div className="mt-4 space-y-4">
      <div className="flex gap-2">
        <CopyBtn label="Copiar por tienda" active={copied === 'tienda'} onClick={() => copyText(byStoreText(), 'tienda')} />
        <CopyBtn label="Copiar por receta (Keep)" active={copied === 'receta'} onClick={() => copyText(byRecipeText(), 'receta')} />
      </div>

      <div className="bg-white rounded-xl shadow-sm p-3">
        <p className="text-xs text-stone-500 mb-2">Agregar algo que no esté en las recetas</p>
        <div className="flex gap-2">
          <input
            value={newItemName}
            onChange={(e) => setNewItemName(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') submitNewItem(); }}
            placeholder="Ej. Papel higiénico"
            className="flex-1 min-w-0 px-3 py-2 rounded-lg border border-stone-200 bg-white text-sm"
          />
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
        {purchaseDone ? <><Check size={16} /> ¡Registrado!</> : 'Marcar compra como hecha'}
      </button>

      {shopping.byStore.map(({ id, label, cls, items }) => {
        const extras = extraItems.filter((x) => x.store === id);
        if (!items.length && !extras.length) return null;
        return (
          <div key={id} className="bg-white rounded-xl shadow-sm overflow-hidden">
            <div className={`px-4 py-2.5 font-semibold text-sm ${cls}`}>{label} · {items.length + extras.length}</div>
            <ul className="divide-y divide-stone-100">
              {items.map((x) => {
                const on = checked[x.key];
                const reminder = !on && lastBoughtLabel(x.item, purchaseHistory);
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
              {extras.map((x) => (
                <li key={x.id} className="flex items-center gap-3 px-4 py-2.5 hover:bg-stone-50">
                  <span
                    onClick={() => toggleExtraItem(x.id)}
                    className={`w-5 h-5 rounded-md border flex items-center justify-center shrink-0 cursor-pointer ${x.checked ? 'bg-emerald-600 border-emerald-600' : 'border-stone-300'}`}
                  >
                    {x.checked && <Check size={14} className="text-white" />}
                  </span>
                  <span onClick={() => toggleExtraItem(x.id)} className={`flex-1 text-sm cursor-pointer ${x.checked ? 'line-through text-stone-300' : 'text-stone-700'}`}>
                    {x.name}
                  </span>
                  <button onClick={() => removeExtraItem(x.id)} className="p-1 text-stone-300 hover:text-rose-600"><Trash2 size={14} /></button>
                </li>
              ))}
            </ul>
          </div>
        );
      })}

      {shopping.pantry.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <div className="px-4 py-2.5 font-semibold text-sm bg-stone-100 text-stone-500">De despensa (revisar si hay) · {shopping.pantry.length}</div>
          <ul className="divide-y divide-stone-100">
            {shopping.pantry.map((x) => {
              const on = checked[x.key];
              const reminder = !on && lastBoughtLabel(x.item, purchaseHistory);
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
