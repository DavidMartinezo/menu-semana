import { useState } from 'react';
import { X, Users } from 'lucide-react';
import { useBackdropClose, CopyBtn } from './ui.jsx';

// Modal para compartir el banco de recetas/plan con otra cuenta de Google (ej. la esposa), o
// unirse al hogar compartido de otra persona con su código. Ver lib/userStorage.js para el
// modelo de datos (households/{id} + puntero en users/{uid}).
export default function SharePanel({ householdId, isMember, onJoin, onLeave, onClose }) {
  const [code, setCode] = useState('');
  const [copied, setCopied] = useState(false);
  const backdrop = useBackdropClose(onClose);

  const copyCode = () => {
    navigator.clipboard.writeText(householdId).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-20 p-0 sm:p-4" {...backdrop}>
      <div className="bg-stone-50 w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-4 py-3 border-b border-stone-200">
          <h3 className="font-semibold text-stone-800 flex items-center gap-1.5"><Users size={16} /> Compartir</h3>
          <button onClick={onClose} className="p-1 text-stone-400"><X size={20} /></button>
        </div>

        <div className="p-4 space-y-4">
          <div>
            <p className="text-sm font-medium text-stone-700 mb-1">Tu código para compartir</p>
            <p className="text-xs text-stone-500 mb-2">
              Quien lo pegue abajo con su propia cuenta de Google va a ver y editar el mismo banco
              de recetas y plan que tú, desde cualquier dispositivo.
            </p>
            <div className="flex items-center gap-2">
              <code className="flex-1 text-xs bg-white border border-stone-200 rounded-lg px-3 py-2.5 truncate">{householdId}</code>
              <CopyBtn label="Copiar" active={copied} onClick={copyCode} />
            </div>
          </div>

          <div className="border-t border-stone-200 pt-4">
            <p className="text-sm font-medium text-stone-700 mb-2">Unirme con un código</p>
            <div className="flex items-center gap-2">
              <input
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="Pega el código aquí"
                className="flex-1 px-3 py-2.5 rounded-lg border border-stone-200 bg-white text-sm"
              />
              <button
                onClick={() => { if (code.trim()) { onJoin(code.trim()); setCode(''); } }}
                disabled={!code.trim()}
                className="px-4 py-2.5 rounded-lg bg-emerald-700 hover:bg-emerald-800 disabled:opacity-40 text-white text-sm font-medium"
              >
                Unirme
              </button>
            </div>
          </div>

          {isMember && (
            <button onClick={onLeave} className="w-full text-sm text-rose-600 py-2">
              Salir del hogar compartido
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
