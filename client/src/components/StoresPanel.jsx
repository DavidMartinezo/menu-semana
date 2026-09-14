import { X, Store, Plus, Trash2 } from 'lucide-react';
import { uid } from '../data/seed.js';
import { useBackdropClose, useLockBodyScroll } from './ui.jsx';

// Modal para que el hogar configure sus propias tiendas (no todo el mundo compra en
// Costco/Walmart) — se usan para agrupar la lista de compras, el selector de cada ingrediente
// en el editor, y como pista para la IA al importar recetas. "Cualquier tienda" es aparte,
// siempre existe, y no se puede editar ni borrar (ver storeMeta en data/seed.js).
export default function StoresPanel({ stores, setStores, onClose }) {
  const backdrop = useBackdropClose(onClose);
  useLockBodyScroll();

  const updateStore = (id, label) => setStores((p) => p.map((s) => (s.id === id ? { ...s, label } : s)));
  const removeStore = (id) => setStores((p) => p.filter((s) => s.id !== id));
  const addStore = () => setStores((p) => [...p, { id: uid(), label: '' }]);

  return (
    <div className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-20 p-0 sm:p-4" {...backdrop}>
      <div className="bg-stone-50 w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl max-h-[85vh] overflow-y-auto overscroll-contain" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-4 py-3 border-b border-stone-200">
          <h3 className="font-semibold text-stone-800 flex items-center gap-1.5"><Store size={16} /> Tiendas</h3>
          <button onClick={onClose} className="p-1 text-stone-400"><X size={20} /></button>
        </div>

        <div className="p-4 space-y-4">
          <p className="text-xs text-stone-500">
            Estas son las tiendas donde compras — se usan para armar la lista de compras y para
            que la IA reparta los ingredientes al importar recetas.
          </p>

          <div className="space-y-2">
            {stores.map((s) => (
              <div key={s.id} className="flex items-center gap-2">
                <input
                  value={s.label}
                  onChange={(e) => updateStore(s.id, e.target.value)}
                  placeholder="Ej. Trader Joe's"
                  className="flex-1 px-3 py-2 rounded-lg border border-stone-200 bg-white text-sm"
                />
                <button onClick={() => removeStore(s.id)} className="p-2 text-stone-400 hover:text-rose-600"><Trash2 size={16} /></button>
              </div>
            ))}
          </div>

          <button onClick={addStore} className="text-sm text-emerald-700 font-medium flex items-center gap-1">
            <Plus size={14} /> Agregar tienda
          </button>

          <p className="text-xs text-stone-400 border-t border-stone-200 pt-3">
            Aparte de estas, siempre existe la opción "Cualquier tienda" para lo que se puede
            comprar en cualquier lado — no se edita ni se borra.
          </p>
        </div>
      </div>
    </div>
  );
}
