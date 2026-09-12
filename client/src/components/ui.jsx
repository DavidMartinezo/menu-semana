// Componentes de UI reutilizables (pequeños y sin estado propio salvo lo mínimo).
import { useState, useRef, useEffect } from 'react';
import { ChevronDown, Copy, Check } from 'lucide-react';

// Cierra un modal al hacer click en el fondo oscuro — pero solo si el click "empezó y terminó"
// ahí mismo. Sin esto, arrastrar el mouse para seleccionar texto dentro del modal y soltar el
// botón afuera dispara un click en el fondo (el navegador lo asigna al ancestro común de donde
// empezó y terminó el arrastre) y cierra el modal, borrando lo que se estuviera escribiendo.
export function useBackdropClose(onClose) {
  const downOnBackdrop = useRef(false);
  return {
    onMouseDown: (e) => { downOnBackdrop.current = e.target === e.currentTarget; },
    onClick: (e) => { if (downOnBackdrop.current && e.target === e.currentTarget) onClose(); },
  };
}

// Confirmación propia para acciones que no se pueden deshacer — en vez del confirm() nativo
// del navegador, que sale con el dominio, en inglés, y sin nada del estilo de la app.
export function ConfirmDialog({ title = 'Confirmar', message, confirmLabel = 'Confirmar', danger = true, onConfirm, onCancel }) {
  const backdrop = useBackdropClose(onCancel);
  return (
    <div className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-30 p-0 sm:p-4" {...backdrop}>
      <div className="bg-stone-50 w-full sm:max-w-sm rounded-t-2xl sm:rounded-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="p-5">
          <h3 className="font-semibold text-stone-800 mb-1.5">{title}</h3>
          <p className="text-sm text-stone-600">{message}</p>
        </div>
        <div className="p-4 pt-0 flex gap-2">
          <button onClick={onCancel} className="flex-1 py-2.5 rounded-xl text-sm font-medium text-stone-600 bg-white border border-stone-200">
            Cancelar
          </button>
          <button
            onClick={onConfirm}
            className={`flex-1 py-2.5 rounded-xl text-sm font-semibold text-white ${danger ? 'bg-rose-600 hover:bg-rose-700' : 'bg-emerald-700 hover:bg-emerald-800'}`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

// Combobox con autocompletado: escribe para filtrar la lista, click o Enter para elegir.
// `options` es un array plano [{value, label, group?}]; `group` agrupa visualmente en el
// desplegable (equivalente a los <optgroup> que tenía el <select> nativo).
export function Autocomplete({ value, onChange, options, placeholder, emptyText = 'Sin resultados' }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [highlight, setHighlight] = useState(0);
  const rootRef = useRef(null);
  const inputRef = useRef(null);

  const selected = options.find((o) => o.value === value);

  useEffect(() => {
    const onDocClick = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) { setOpen(false); setQuery(''); }
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  const q = query.trim().toLowerCase();
  const matches = q ? options.filter((o) => o.label.toLowerCase().includes(q)) : options;
  // Con la caja vacía y algo ya elegido, se ofrece "quitar selección" para volver a vaciar el día.
  // Va aparte (no entra al ordenamiento alfabético) para quedar siempre arriba de todo.
  const showClear = !q && !!value;
  const clearItem = { value: '', label: 'Quitar selección', clear: true };

  // Se agrupa preservando el orden de aparición de cada grupo (ej. "⚡ Fáciles" antes que
  // "Otras"), pero las coincidencias dentro de cada grupo se ordenan alfabéticamente.
  const groups = [];
  for (const o of matches) {
    const g = o.group || '';
    let bucket = groups.find((b) => b.name === g);
    if (!bucket) { bucket = { name: g, items: [] }; groups.push(bucket); }
    bucket.items.push(o);
  }
  groups.forEach((b) => b.items.sort((a, c) => a.label.localeCompare(c.label, 'es', { sensitivity: 'base' })));

  const flat = [...(showClear ? [clearItem] : []), ...groups.flatMap((g) => g.items)];

  const commit = (opt) => {
    onChange(opt.value);
    setQuery('');
    setOpen(false);
    inputRef.current?.blur();
  };

  const handleKeyDown = (e) => {
    if (!open) { if (e.key === 'ArrowDown' || e.key === 'Enter') { setOpen(true); setHighlight(0); } return; }
    if (e.key === 'ArrowDown') { e.preventDefault(); setHighlight((h) => Math.min(h + 1, flat.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setHighlight((h) => Math.max(h - 1, 0)); }
    else if (e.key === 'Enter') { e.preventDefault(); if (flat[highlight]) commit(flat[highlight]); }
    else if (e.key === 'Escape') { setOpen(false); setQuery(''); inputRef.current?.blur(); }
  };

  return (
    <div className="relative" ref={rootRef}>
      <input
        ref={inputRef}
        value={open ? query : (selected?.label || '')}
        onChange={(e) => { setQuery(e.target.value); setOpen(true); setHighlight(0); }}
        onFocus={() => { setOpen(true); setQuery(''); setHighlight(0); }}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className={`w-full px-3 py-2.5 pr-9 rounded-lg border border-stone-200 bg-white text-sm ${selected ? 'text-stone-800' : 'text-stone-400'}`}
      />
      <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 pointer-events-none" />
      {open && (
        <div className="absolute z-20 mt-1 w-full max-h-64 overflow-y-auto rounded-lg border border-stone-200 bg-white shadow-lg text-sm">
          {flat.length === 0 && <div className="px-3 py-2 text-stone-400">{emptyText}</div>}
          {showClear && (
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => commit(clearItem)}
              className={`w-full text-left px-3 py-2 text-stone-400 italic ${highlight === 0 ? 'bg-emerald-50' : 'hover:bg-emerald-50'}`}
            >
              {clearItem.label}
            </button>
          )}
          {groups.map((g) => (
            <div key={g.name || '_root'}>
              {g.name && <div className="px-3 pt-2 pb-1 text-xs font-semibold text-stone-400 uppercase">{g.name}</div>}
              {g.items.map((o) => {
                const idx = flat.indexOf(o);
                return (
                  <button
                    type="button"
                    key={o.value}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => commit(o)}
                    className={`w-full text-left px-3 py-2 ${idx === highlight ? 'bg-emerald-50' : 'hover:bg-emerald-50'} ${o.value === value ? 'font-medium text-emerald-700' : 'text-stone-700'}`}
                  >
                    {o.label}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function Tag({ children }) {
  return <span className="text-xs bg-stone-100 text-stone-500 px-2 py-0.5 rounded-full">{children}</span>;
}

export function Toggle({ on, set, label }) {
  return (
    <button
      onClick={() => set(!on)}
      className={`flex-1 text-xs py-2 rounded-lg border font-medium ${on ? 'bg-emerald-700 text-white border-emerald-700' : 'bg-white text-stone-500 border-stone-200'}`}
    >
      {label}
    </button>
  );
}

// Calificación de 0 a 5 estrellas. Click en una estrella la marca como el nuevo valor;
// click en la estrella ya seleccionada (solo cuando es la única) la quita.
export function Stars({ value, onChange, size = 18 }) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          onClick={() => onChange(n === value ? 0 : n)}
          className={n <= value ? 'text-amber-500' : 'text-stone-300'}
          style={{ fontSize: size, lineHeight: 1 }}
        >
          ★
        </button>
      ))}
    </div>
  );
}

// Versión de solo lectura, para mostrar la calificación en listas/tarjetas.
export function StarsDisplay({ value }) {
  return <span className="text-amber-500 tracking-tighter">{'★'.repeat(value)}{'☆'.repeat(5 - value)}</span>;
}

export function CopyBtn({ label, onClick, active }) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-sm font-medium shadow-sm transition ${active ? 'bg-emerald-600 text-white' : 'bg-white text-stone-600 hover:bg-stone-100'}`}
    >
      {active ? <Check size={16} /> : <Copy size={16} />} {active ? '¡Copiado!' : label}
    </button>
  );
}
