// Selector de idioma casero (sin librería): un diccionario plano por idioma + un contexto de
// React que expone t(clave, variables?). Cambiar el idioma es un simple setState — como todo
// componente que llama a t() está suscrito al contexto, React los vuelve a renderizar solos,
// sin recargar la página ni pedir nada al servidor.
import { createContext, useContext, useState, useEffect } from 'react';
import es from './es.js';
import en from './en.js';

const DICTS = { es, en };
const LANG_KEY = 'menu-semana:lang';

const LanguageContext = createContext(null);

function detectDefault() {
  try {
    const saved = localStorage.getItem(LANG_KEY);
    if (saved === 'es' || saved === 'en') return saved;
  } catch { /* localStorage puede no estar disponible */ }
  return navigator.language?.toLowerCase().startsWith('en') ? 'en' : 'es';
}

export function LanguageProvider({ children }) {
  const [lang, setLang] = useState(detectDefault);

  useEffect(() => {
    try { localStorage.setItem(LANG_KEY, lang); } catch { /* noop */ }
    // index.html trae lang="es" fijo; acá se corrige al idioma real para lectores de pantalla
    // y para que el navegador no ofrezca traducir una página que ya está en el idioma pedido.
    document.documentElement.lang = lang;
  }, [lang]);

  const t = (key, vars) => {
    let text = DICTS[lang][key] ?? DICTS.es[key] ?? key;
    if (vars) {
      for (const [k, v] of Object.entries(vars)) text = text.replaceAll(`{${k}}`, v);
    }
    return text;
  };

  return <LanguageContext.Provider value={{ lang, setLang, t }}>{children}</LanguageContext.Provider>;
}

export function useT() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error('useT() debe usarse dentro de <LanguageProvider>');
  return ctx;
}
