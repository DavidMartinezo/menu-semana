import { useState } from 'react';
import { signInWithGoogle, signInAsGuest } from '../lib/auth.js';
import { joinHousehold } from '../lib/userStorage.js';
import { track } from '../lib/analytics.js';

function mapAuthError(code) {
  if (code === 'auth/popup-closed-by-user') return 'Cerraste la ventana antes de terminar de iniciar sesión.';
  if (code === 'auth/popup-blocked') return 'El navegador bloqueó la ventana emergente. Permite popups e inténtalo de nuevo.';
  if (code === 'auth/unauthorized-domain') return 'Este dominio no está autorizado en Firebase (Authentication > Settings > Authorized domains).';
  if (code === 'auth/operation-not-allowed') return 'El login con Google no está habilitado en Firebase (Authentication > Sign-in method).';
  return 'No se pudo iniciar sesión. Inténtalo de nuevo.';
}

// Logo oficial de Google ("G" multicolor), en línea como SVG para no depender de ninguna librería.
function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
      <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.9c1.7-1.57 2.68-3.87 2.68-6.62z" />
      <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.9-2.26c-.8.54-1.83.86-3.06.86-2.35 0-4.34-1.59-5.05-3.72H.96v2.33A9 9 0 0 0 9 18z" />
      <path fill="#FBBC05" d="M3.95 10.7A5.4 5.4 0 0 1 3.67 9c0-.59.1-1.17.28-1.7V4.97H.96A9 9 0 0 0 0 9c0 1.45.35 2.83.96 4.03l2.99-2.33z" />
      <path fill="#EA4335" d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58C13.46.89 11.43 0 9 0A9 9 0 0 0 .96 4.97l2.99 2.33C4.66 5.17 6.65 3.58 9 3.58z" />
    </svg>
  );
}

export default function Login() {
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [loadingGuest, setLoadingGuest] = useState(false);
  const [joinOpen, setJoinOpen] = useState(false);
  const [joinCode, setJoinCode] = useState('');
  const [loadingJoin, setLoadingJoin] = useState(false);
  const busy = loading || loadingGuest || loadingJoin;

  const handleClick = async () => {
    setError(null);
    setLoading(true);
    try {
      await signInWithGoogle();
      // No hace falta hacer nada más acá — el listener onAuthChange en AuthGate
      // detecta la sesión nueva y cambia a la app solo.
    } catch (e) {
      setError(mapAuthError(e.code));
    } finally {
      setLoading(false);
    }
  };

  const handleGuest = async () => {
    setError(null);
    setLoadingGuest(true);
    try {
      await signInAsGuest();
      track('guest_start');
    } catch (e) {
      setError(mapAuthError(e.code));
    } finally {
      setLoadingGuest(false);
    }
  };

  // Entra como invitado (misma cuenta anónima temporal) y de una la une al hogar del código —
  // para alguien sin cuenta de Google que solo quiere ver/editar lo que ya comparte otra persona.
  const handleJoinWithCode = async () => {
    const code = joinCode.trim();
    if (!code) return;
    setError(null);
    setLoadingJoin(true);
    try {
      const cred = await signInAsGuest();
      await joinHousehold(code, cred.user.uid);
      track('guest_start', { joined_with_code: true });
    } catch (e) {
      setError(mapAuthError(e.code));
    } finally {
      setLoadingJoin(false);
    }
  };

  return (
    <div className="min-h-screen bg-stone-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-sm p-8 max-w-sm w-full text-center">
        <h1 className="text-2xl font-bold text-emerald-800 tracking-tight">Menú de la semana</h1>
        <p className="text-sm text-stone-500 mt-2 mb-6">Inicia sesión para ver tus recetas y tu plan.</p>
        <button
          onClick={handleClick}
          disabled={busy}
          className="w-full flex items-center justify-center gap-2.5 bg-white hover:bg-stone-50 disabled:opacity-50 text-stone-700 font-semibold py-3 rounded-xl shadow-sm border border-stone-200"
        >
          {!loading && <GoogleIcon />}
          {loading ? 'Conectando… (puede tardar un poco la primera vez)' : 'Continuar con Google'}
        </button>
        <button
          onClick={handleGuest}
          disabled={busy}
          className="w-full mt-3 bg-stone-100 hover:bg-stone-200 disabled:opacity-50 text-stone-600 font-medium py-2.5 rounded-xl"
        >
          {loadingGuest ? 'Conectando…' : 'Usar sin cuenta'}
        </button>
        <p className="text-xs text-stone-400 mt-2">Como invitado nada se pierde en tu navegador, pero no lo ves desde otro dispositivo.</p>

        {!joinOpen ? (
          <button onClick={() => setJoinOpen(true)} className="w-full mt-3 text-xs text-stone-400 hover:text-stone-600 underline">
            ¿Tienes un código para unirte a un hogar compartido?
          </button>
        ) : (
          <div className="mt-3 text-left">
            <div className="flex items-center gap-2">
              <input
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value)}
                placeholder="Pega el código aquí"
                className="flex-1 px-3 py-2 rounded-lg border border-stone-200 text-sm"
              />
              <button
                onClick={handleJoinWithCode}
                disabled={busy || !joinCode.trim()}
                className="px-3 py-2 rounded-lg bg-emerald-700 hover:bg-emerald-800 disabled:opacity-40 text-white text-sm font-medium"
              >
                {loadingJoin ? '…' : 'Unirme'}
              </button>
            </div>
            <p className="text-xs text-stone-400 mt-1.5">Entra como invitado, ya unido a esos datos — misma limitación: no se ve desde otro dispositivo sin volver a pegar el código.</p>
          </div>
        )}
        {error && <p className="mt-4 text-sm text-rose-600 bg-rose-50 border border-rose-100 rounded-lg p-2">{error}</p>}
      </div>
    </div>
  );
}
