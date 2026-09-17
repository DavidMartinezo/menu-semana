import { useT } from '../lib/i18n/LanguageContext.jsx';

// Los nombres de idioma no se traducen a propósito (ES/EN son reconocibles en cualquier idioma).
export default function LanguageToggle({ className = '' }) {
  const { lang, setLang } = useT();
  return (
    <div className={`inline-flex rounded-lg border border-stone-200 overflow-hidden text-xs font-semibold shrink-0 ${className}`}>
      <button
        onClick={() => setLang('es')}
        className={`px-2 py-1 ${lang === 'es' ? 'bg-emerald-700 text-white' : 'bg-white text-stone-500 hover:bg-stone-50'}`}
      >
        ES
      </button>
      <button
        onClick={() => setLang('en')}
        className={`px-2 py-1 ${lang === 'en' ? 'bg-emerald-700 text-white' : 'bg-white text-stone-500 hover:bg-stone-50'}`}
      >
        EN
      </button>
    </div>
  );
}
