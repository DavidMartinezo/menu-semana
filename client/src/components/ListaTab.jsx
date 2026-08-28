import { useState } from 'react';
import { ShoppingCart, Check } from 'lucide-react';
import { DAYS, STORE_META } from '../data/seed.js';
import { CopyBtn } from './ui.jsx';

export default function ListaTab({ shopping, checked, setChecked, plan, mealById }) {
  const [copied, setCopied] = useState('');
  const anyMeals = DAYS.some((d) => mealById[plan[d.key]]);

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
    for (const [store, title] of [['costco', 'COSTCO'], ['walmart', 'WALMART'], ['both', 'CUALQUIER TIENDA']]) {
      const list = shopping[store];
      if (!list.length) continue;
      out += `\n— ${title} —\n`;
      list.forEach((x) => (out += `☐ ${qtyPrefix(x)}${x.item}\n`));
    }
    if (shopping.pantry.length) {
      out += '\n— DE DESPENSA (revisar si hay) —\n';
      shopping.pantry.forEach((x) => (out += `☐ ${x.item}\n`));
    }
    return out.trim();
  };

  const byRecipeText = () => {
    let out = '';
    for (const d of DAYS) {
      const m = mealById[plan[d.key]];
      if (!m) continue;
      out += `${m.name}\n`;
      m.ing.forEach((g) => {
        const qty = typeof g.qty === 'number' ? `${g.qty}${g.unit ? ' ' + g.unit : ''} ` : '';
        out += `  • ${qty}${g.item} (${STORE_META[g.store].label}${g.pantry ? ', despensa' : ''})\n`;
      });
      out += '\n';
    }
    return out.trim();
  };

  if (!anyMeals) {
    return (
      <div className="mt-10 text-center text-stone-400">
        <ShoppingCart size={32} className="mx-auto mb-2 opacity-40" />
        Elige cenas en la pestaña <span className="font-medium text-stone-500">Semana</span> y aquí aparece la lista lista para Costco y Walmart.
      </div>
    );
  }

  return (
    <div className="mt-4 space-y-4">
      <div className="flex gap-2">
        <CopyBtn label="Copiar por tienda" active={copied === 'tienda'} onClick={() => copyText(byStoreText(), 'tienda')} />
        <CopyBtn label="Copiar por receta (Keep)" active={copied === 'receta'} onClick={() => copyText(byRecipeText(), 'receta')} />
      </div>

      {[['costco', 'Costco'], ['walmart', 'Walmart'], ['both', 'Cualquier tienda']].map(([store, title]) => {
        const list = shopping[store];
        if (!list.length) return null;
        return (
          <div key={store} className="bg-white rounded-xl shadow-sm overflow-hidden">
            <div className={`px-4 py-2.5 font-semibold text-sm ${STORE_META[store].cls}`}>{title} · {list.length}</div>
            <ul className="divide-y divide-stone-100">
              {list.map((x) => {
                const key = store + ':' + x.item + ':' + x.unit;
                const on = checked[key];
                return (
                  <li key={key} onClick={() => setChecked((c) => ({ ...c, [key]: !c[key] }))}
                    className="flex items-center gap-3 px-4 py-2.5 cursor-pointer hover:bg-stone-50">
                    <span className={`w-5 h-5 rounded-md border flex items-center justify-center shrink-0 ${on ? 'bg-emerald-600 border-emerald-600' : 'border-stone-300'}`}>
                      {on && <Check size={14} className="text-white" />}
                    </span>
                    <span className={`flex-1 text-sm ${on ? 'line-through text-stone-300' : 'text-stone-700'}`}>
                      {x.hasQty && <span className="text-stone-400 font-medium">{x.qty}{x.unit ? ` ${x.unit}` : ''} </span>}
                      {x.item}
                    </span>
                    <span className="text-xs text-stone-400 truncate max-w-[45%]">{x.from.join(', ')}</span>
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}

      {shopping.pantry.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <div className="px-4 py-2.5 font-semibold text-sm bg-stone-100 text-stone-500">De despensa (revisar si hay) · {shopping.pantry.length}</div>
          <ul className="divide-y divide-stone-100">
            {shopping.pantry.map((x) => {
              const key = 'pantry:' + x.item;
              const on = checked[key];
              return (
                <li key={key} onClick={() => setChecked((c) => ({ ...c, [key]: !c[key] }))}
                  className="flex items-center gap-3 px-4 py-2.5 cursor-pointer hover:bg-stone-50">
                  <span className={`w-5 h-5 rounded-md border flex items-center justify-center shrink-0 ${on ? 'bg-emerald-600 border-emerald-600' : 'border-stone-300'}`}>
                    {on && <Check size={14} className="text-white" />}
                  </span>
                  <span className={`flex-1 text-sm ${on ? 'line-through text-stone-300' : 'text-stone-700'}`}>{x.item}</span>
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
