// Componentes de UI reutilizables (pequeños y sin estado propio salvo lo mínimo).
import { ChevronDown, Copy, Check } from 'lucide-react';

export function Select({ value, onChange, children, placeholder }) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`w-full appearance-none px-3 py-2.5 pr-9 rounded-lg border bg-white text-sm ${value ? 'border-stone-200 text-stone-800' : 'border-stone-200 text-stone-400'}`}
      >
        <option value="">{placeholder}</option>
        {children}
      </select>
      <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 pointer-events-none" />
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
