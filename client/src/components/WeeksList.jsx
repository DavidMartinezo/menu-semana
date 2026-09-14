import { useState } from 'react';
import { X, Trash2, ArrowRight, CalendarDays } from 'lucide-react';
import { DAYS, EMPTY_WEEK } from '../data/seed.js';
import { addDays, formatShort } from '../lib/dates.js';
import { useBackdropClose, useLockBodyScroll, ConfirmDialog } from './ui.jsx';

// Modal con la lista de todas las semanas guardadas (pasadas y futuras), para saltar entre
// ellas sin perder lo que ya está planeado en cada una.
export default function WeeksList({ weeks, weekStart, onSelect, onDelete, onClose }) {
  // La semana activa siempre aparece en la lista, aunque todavía no tenga nada guardado.
  const all = { ...weeks, [weekStart]: weeks[weekStart] || EMPTY_WEEK };
  const keys = Object.keys(all).sort();
  const backdrop = useBackdropClose(onClose);
  const [confirmDeleteKey, setConfirmDeleteKey] = useState(null);
  useLockBodyScroll();

  return (
    <div className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-20 p-0 sm:p-4" {...backdrop}>
      <div className="bg-stone-50 w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl max-h-[80vh] overflow-y-auto overscroll-contain" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-4 py-3 sticky top-0 bg-stone-50 border-b border-stone-200 z-10">
          <h3 className="font-semibold text-stone-800 flex items-center gap-1.5"><CalendarDays size={16} /> Mis semanas</h3>
          <button onClick={onClose} className="p-1 text-stone-400"><X size={20} /></button>
        </div>

        <div className="p-4 space-y-2">
          {keys.map((key) => {
            const w = all[key];
            const cenas = Object.values(w.plan || {}).filter(Boolean).length;
            const active = key === weekStart;
            return (
              <div key={key} className={`flex items-center gap-2 p-3 rounded-xl border ${active ? 'bg-emerald-50 border-emerald-200' : 'bg-white border-stone-200'}`}>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-stone-800 text-sm">
                    {formatShort(key)} – {formatShort(addDays(key, DAYS.length - 1))}
                    {active && <span className="ml-1.5 text-xs text-emerald-700 font-normal">· viendo</span>}
                  </div>
                  <div className="text-xs text-stone-400">{cenas}/{DAYS.length} cenas planeadas</div>
                </div>
                {!active && (
                  <button onClick={() => onSelect(key)} className="p-2 text-emerald-700 hover:bg-emerald-50 rounded-lg" title="Ver esta semana">
                    <ArrowRight size={16} />
                  </button>
                )}
                <button
                  onClick={() => setConfirmDeleteKey(key)}
                  className="p-2 text-stone-400 hover:text-rose-600 rounded-lg"
                  title="Eliminar esta semana"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {confirmDeleteKey && (
        <ConfirmDialog
          title="Eliminar semana"
          message="¿Eliminar esta semana? No se puede deshacer."
          confirmLabel="Eliminar"
          onConfirm={() => { onDelete(confirmDeleteKey); setConfirmDeleteKey(null); }}
          onCancel={() => setConfirmDeleteKey(null)}
        />
      )}
    </div>
  );
}
