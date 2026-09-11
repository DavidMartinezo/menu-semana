import { useEffect, useState } from 'react';
import { onAuthChange } from '../lib/auth.js';
import Login from './Login.jsx';
import App from '../App.jsx';

// Puerta de autenticación: se monta en main.jsx en vez de <App/> directamente. Sin sesión,
// la app entera no se usa (login obligatorio) — así se evita mantener dos modos en paralelo
// (local sin cuenta + nube con cuenta).
export default function AuthGate() {
  const [user, setUser] = useState(undefined); // undefined = resolviendo, null = sin sesión, objeto = con sesión

  useEffect(() => {
    const unsubscribe = onAuthChange(setUser);
    return unsubscribe;
  }, []);

  if (user === undefined) {
    return <div className="min-h-screen bg-stone-50 flex items-center justify-center text-stone-400">Cargando…</div>;
  }
  if (user === null) {
    return <Login />;
  }
  // key={user.uid}: si alguien cierra sesión e inicia con otra cuenta en la misma pestaña,
  // App se vuelve a montar desde cero (sus useState se resetean solos).
  return <App user={user} key={user.uid} />;
}
