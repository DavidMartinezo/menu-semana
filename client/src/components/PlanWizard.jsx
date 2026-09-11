import { useState } from 'react';
import { X, ChevronRight, ChevronLeft, Wand2 } from 'lucide-react';
import { DAYS } from '../data/seed.js';
import { useBackdropClose } from './ui.jsx';

// Asistente de 2 pasos: qué días están ocupados, y si la semana debe ser solo saludable.
// Al aplicar, reemplaza busyDays por la selección y dispara autofill con esos valores.
export default function PlanWizard({ busyDays, healthyOnly, lunchPoolSize, onClose, onApply }) {
  const [step, setStep] = useState(0);
  const [selDays, setSelDays] = useState(busyDays || {});
  const [selHealthy, setSelHealthy] = useState(!!healthyOnly);
  // 'reuse' = aprovechar la cena de ayer donde se pueda, el resto queda para elegir a mano.
  // 'generate' = una receta de almuerzo real todos los días, sin depender de la cena anterior.
  // Son excluyentes — no tiene sentido combinarlas para la semana completa.
  const [lunchMode, setLunchMode] = useState('reuse');

  const toggleDay = (key) => setSelDays((p) => ({ ...p, [key]: !p[key] }));
  const backdrop = useBackdropClose(onClose);

  return (
    <div className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-20 p-0 sm:p-4" {...backdrop}>
      <div className="bg-stone-50 w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-4 py-3 border-b border-stone-200">
          <h3 className="font-semibold text-stone-800 flex items-center gap-1.5"><Wand2 size={16} /> Asistente de la semana</h3>
          <button onClick={onClose} className="p-1 text-stone-400"><X size={20} /></button>
        </div>

        <div className="p-4 min-h-[260px]">
          {step === 0 && (
            <div>
              <p className="text-sm font-medium text-stone-700 mb-1">¿Qué días están ocupados?</p>
              <p className="text-xs text-stone-500 mb-3">Esos días solo vamos a sugerir recetas ⚡ fáciles.</p>
              <div className="grid grid-cols-2 gap-2">
                {DAYS.map((d) => (
                  <button
                    key={d.key}
                    onClick={() => toggleDay(d.key)}
                    className={`text-sm py-2.5 rounded-lg border font-medium ${selDays[d.key] ? 'bg-amber-100 text-amber-700 border-amber-200' : 'bg-white text-stone-500 border-stone-200'}`}
                  >
                    {d.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {step === 1 && (
            <div>
              <p className="text-sm font-medium text-stone-700 mb-1">¿Cómo quieres la semana?</p>
              <p className="text-xs text-stone-500 mb-3">Esto también queda como preferencia en la pestaña Recetas.</p>
              <div className="space-y-2">
                <button
                  onClick={() => setSelHealthy(false)}
                  className={`w-full text-left px-4 py-3 rounded-lg border ${!selHealthy ? 'bg-emerald-700 text-white border-emerald-700' : 'bg-white text-stone-600 border-stone-200'}`}
                >
                  <div className="font-medium">Variado</div>
                  <div className={`text-xs ${!selHealthy ? 'text-emerald-100' : 'text-stone-400'}`}>Cualquier receta del banco</div>
                </button>
                <button
                  onClick={() => setSelHealthy(true)}
                  className={`w-full text-left px-4 py-3 rounded-lg border ${selHealthy ? 'bg-emerald-700 text-white border-emerald-700' : 'bg-white text-stone-600 border-stone-200'}`}
                >
                  <div className="font-medium">🥗 Solo saludables</div>
                  <div className={`text-xs ${selHealthy ? 'text-emerald-100' : 'text-stone-400'}`}>Solo recetas marcadas como saludables</div>
                </button>
              </div>

              <div className="mt-5 pt-4 border-t border-stone-200">
                <p className="text-sm font-medium text-stone-700 mb-1">¿Cómo resolver el almuerzo?</p>
                <p className="text-xs text-stone-500 mb-3">Elige una — no se combinan.</p>
                <div className="space-y-2">
                  <button
                    onClick={() => setLunchMode('reuse')}
                    className={`w-full text-left px-4 py-3 rounded-lg border ${lunchMode === 'reuse' ? 'bg-emerald-700 text-white border-emerald-700' : 'bg-white text-stone-600 border-stone-200'}`}
                  >
                    <div className="font-medium">Aprovechar la cena de ayer</div>
                    <div className={`text-xs ${lunchMode === 'reuse' ? 'text-emerald-100' : 'text-stone-400'}`}>
                      Los días con cena que rinde quedan con esa sugerencia; los demás se dejan para elegir a mano.
                    </div>
                  </button>
                  <button
                    disabled={lunchPoolSize === 0}
                    onClick={() => setLunchMode('generate')}
                    className={`w-full text-left px-4 py-3 rounded-lg border disabled:opacity-40 ${lunchMode === 'generate' ? 'bg-emerald-700 text-white border-emerald-700' : 'bg-white text-stone-600 border-stone-200'}`}
                  >
                    <div className="font-medium">Generar recetas de almuerzo</div>
                    <div className={`text-xs ${lunchMode === 'generate' ? 'text-emerald-100' : 'text-stone-400'}`}>
                      {lunchPoolSize === 0
                        ? 'Aún no tienes recetas marcadas como almuerzo — agrégaselo en Recetas'
                        : 'Una receta real cada día, sin depender de la cena anterior.'}
                    </div>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="p-4 border-t border-stone-200 flex gap-2">
          {step > 0 && (
            <button onClick={() => setStep((s) => s - 1)} className="px-4 py-2.5 rounded-xl text-sm font-medium text-stone-500 bg-white border border-stone-200 flex items-center gap-1">
              <ChevronLeft size={16} /> Atrás
            </button>
          )}
          {step === 0 ? (
            <button onClick={() => setStep(1)} className="flex-1 flex items-center justify-center gap-1 bg-emerald-700 hover:bg-emerald-800 text-white font-semibold py-2.5 rounded-xl">
              Siguiente <ChevronRight size={16} />
            </button>
          ) : (
            <button
              onClick={() => onApply({
                busyDays: selDays,
                healthyOnly: selHealthy,
                reuseDinner: lunchMode === 'reuse',
                fillLunch: lunchMode === 'generate' && lunchPoolSize > 0,
              })}
              className="flex-1 bg-amber-500 hover:bg-amber-600 text-white font-semibold py-2.5 rounded-xl"
            >
              Armar semana
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
