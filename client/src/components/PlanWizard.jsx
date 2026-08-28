import { useState } from 'react';
import { X, ChevronRight, ChevronLeft, Wand2 } from 'lucide-react';
import { DAYS } from '../data/seed.js';

// Asistente de 2 pasos: qué días están ocupados, y si la semana debe ser solo saludable.
// Al aplicar, reemplaza busyDays por la selección y dispara autofill con esos valores.
export default function PlanWizard({ busyDays, healthyOnly, onClose, onApply }) {
  const [step, setStep] = useState(0);
  const [selDays, setSelDays] = useState(busyDays || {});
  const [selHealthy, setSelHealthy] = useState(!!healthyOnly);

  const toggleDay = (key) => setSelDays((p) => ({ ...p, [key]: !p[key] }));

  return (
    <div className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-20 p-0 sm:p-4" onClick={onClose}>
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
              onClick={() => onApply({ busyDays: selDays, healthyOnly: selHealthy })}
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
